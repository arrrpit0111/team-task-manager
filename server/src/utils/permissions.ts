import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "./http.js";

export const requireProjectMembership = async (userId: string, projectId: string) => {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });

  if (!membership) {
    throw new AppError(403, "You are not a member of this project");
  }

  return membership;
};

export const requireProjectAdmin = async (userId: string, projectId: string) => {
  const membership = await requireProjectMembership(userId, projectId);

  if (membership.role !== Role.ADMIN) {
    throw new AppError(403, "Admin access is required for this action");
  }

  return membership;
};

export const ensureProjectAssignee = async (projectId: string, assigneeId?: string | null) => {
  if (!assigneeId) {
    return;
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } }
  });

  if (!membership) {
    throw new AppError(400, "Assignee must be a member of the selected project");
  }
};

export const visibleTaskWhere = async (
  userId: string,
  projectId?: string
): Promise<Prisma.TaskWhereInput> => {
  const memberships = await prisma.projectMember.findMany({
    where: projectId ? { userId, projectId } : { userId },
    select: { projectId: true, role: true }
  });

  if (projectId && memberships.length === 0) {
    throw new AppError(403, "You are not a member of this project");
  }

  const adminProjectIds = memberships
    .filter((membership) => membership.role === Role.ADMIN)
    .map((membership) => membership.projectId);

  const memberProjectIds = memberships.map((membership) => membership.projectId);

  const clauses: Prisma.TaskWhereInput[] = [];

  if (adminProjectIds.length > 0) {
    clauses.push({ projectId: { in: adminProjectIds } });
  }

  if (memberProjectIds.length > 0) {
    clauses.push({ projectId: { in: memberProjectIds }, assigneeId: userId });
  }

  if (clauses.length === 0) {
    return { id: { in: [] } };
  }

  return { OR: clauses };
};
