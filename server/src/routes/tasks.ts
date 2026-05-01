import { Priority, Role, TaskStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError } from "../utils/http.js";
import {
  ensureProjectAssignee,
  requireProjectAdmin,
  requireProjectMembership,
  visibleTaskWhere
} from "../utils/permissions.js";

export const taskRouter = Router();

taskRouter.use(authenticate);

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } }
};

const dueDateSchema = z
  .string()
  .min(1, "Due date is required")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Due date must be valid");

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Task title must be at least 2 characters"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  dueDate: dueDateSchema,
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().optional().nullable()
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  dueDate: dueDateSchema.optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().optional().nullable()
});

taskRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const where = await visibleTaskWhere(req.user!.id, projectId);

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }]
    });

    res.json({ tasks });
  })
);

taskRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createTaskSchema.parse(req.body);
    await requireProjectAdmin(req.user!.id, data.projectId);
    await ensureProjectAssignee(data.projectId, data.assigneeId);

    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        dueDate: new Date(data.dueDate),
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        creatorId: req.user!.id
      },
      include: taskInclude
    });

    res.status(201).json({ task });
  })
);

taskRouter.patch(
  "/:taskId",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const data = updateTaskSchema.parse(req.body);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude
    });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const membership = await requireProjectMembership(req.user!.id, task.projectId);
    const isAdmin = membership.role === Role.ADMIN;
    const isAssignee = task.assigneeId === req.user!.id;

    if (!isAdmin) {
      const requestedFields = Object.keys(data);
      if (!isAssignee || requestedFields.some((field) => field !== "status")) {
        throw new AppError(403, "Members can only update the status of tasks assigned to them");
      }
    }

    if (isAdmin && data.assigneeId !== undefined) {
      await ensureProjectAssignee(task.projectId, data.assigneeId);
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(isAdmin && data.title !== undefined ? { title: data.title } : {}),
        ...(isAdmin && data.description !== undefined ? { description: data.description || null } : {}),
        ...(isAdmin && data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
        ...(isAdmin && data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(isAdmin && data.assigneeId !== undefined ? { assigneeId: data.assigneeId || null } : {})
      },
      include: taskInclude
    });

    res.json({ task: updatedTask });
  })
);

taskRouter.delete(
  "/:taskId",
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    await requireProjectAdmin(req.user!.id, task.projectId);
    await prisma.task.delete({ where: { id: taskId } });

    res.status(204).send();
  })
);
