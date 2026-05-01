import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError, normalizeEmail } from "../utils/http.js";
import { requireProjectAdmin, requireProjectMembership } from "../utils/permissions.js";

export const projectRouter = Router();

projectRouter.use(authenticate);

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  description: z.string().trim().max(500).optional().or(z.literal(""))
});

const memberSchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(Role).default(Role.MEMBER)
});

const roleSchema = z.object({
  role: z.nativeEnum(Role)
});

const projectInclude = {
  members: {
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: [{ role: "asc" as const }, { joinedAt: "asc" as const }]
  },
  _count: {
    select: { tasks: true, members: true }
  }
};

projectRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      include: {
        project: {
          include: projectInclude
        }
      }
    });

    res.json({
      projects: memberships.map((membership) => ({
        ...membership.project,
        currentUserRole: membership.role
      }))
    });
  })
);

projectRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = projectSchema.parse(req.body);
    const userId = req.user!.id;

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: data.name,
          description: data.description || null,
          createdById: userId
        }
      });

      await tx.projectMember.create({
        data: {
          projectId: createdProject.id,
          userId,
          role: Role.ADMIN
        }
      });

      return tx.project.findUniqueOrThrow({
        where: { id: createdProject.id },
        include: projectInclude
      });
    });

    res.status(201).json({ project: { ...project, currentUserRole: Role.ADMIN } });
  })
);

projectRouter.get(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const membership = await requireProjectMembership(req.user!.id, projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        ...projectInclude,
        tasks: {
          where: membership.role === Role.ADMIN ? undefined : { assigneeId: req.user!.id },
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            creator: { select: { id: true, name: true, email: true } }
          },
          orderBy: [{ status: "asc" }, { dueDate: "asc" }]
        }
      }
    });

    if (!project) {
      throw new AppError(404, "Project not found");
    }

    res.json({ project: { ...project, currentUserRole: membership.role } });
  })
);

projectRouter.patch(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await requireProjectAdmin(req.user!.id, projectId);
    const data = projectSchema.partial().parse(req.body);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {})
      },
      include: projectInclude
    });

    res.json({ project: { ...project, currentUserRole: Role.ADMIN } });
  })
);

projectRouter.post(
  "/:projectId/members",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await requireProjectAdmin(req.user!.id, projectId);
    const data = memberSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(data.email) },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      throw new AppError(404, "No registered user found with that email");
    }

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      update: { role: data.role },
      create: {
        projectId,
        userId: user.id,
        role: data.role
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json({ member });
  })
);

projectRouter.patch(
  "/:projectId/members/:userId",
  asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;
    await requireProjectAdmin(req.user!.id, projectId);
    const data = roleSchema.parse(req.body);

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!target) {
      throw new AppError(404, "Project member not found");
    }

    if (target.role === Role.ADMIN && data.role === Role.MEMBER) {
      const adminCount = await prisma.projectMember.count({ where: { projectId, role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new AppError(400, "A project must have at least one admin");
      }
    }

    const member = await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: data.role },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({ member });
  })
);

projectRouter.delete(
  "/:projectId/members/:userId",
  asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;
    await requireProjectAdmin(req.user!.id, projectId);

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!target) {
      throw new AppError(404, "Project member not found");
    }

    if (target.role === Role.ADMIN) {
      const adminCount = await prisma.projectMember.count({ where: { projectId, role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new AppError(400, "A project must have at least one admin");
      }
    }

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { projectId, assigneeId: userId },
        data: { assigneeId: null }
      }),
      prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId } }
      })
    ]);

    res.status(204).send();
  })
);
