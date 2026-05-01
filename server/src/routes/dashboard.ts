import { TaskStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { visibleTaskWhere } from "../utils/permissions.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } }
};

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const where = await visibleTaskWhere(req.user!.id, projectId);

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }]
    });

    const byStatus: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0
    };

    const perUser = new Map<string, { userId: string | null; name: string; count: number }>();
    const now = new Date();

    for (const task of tasks) {
      byStatus[task.status] += 1;
      const userKey = task.assignee?.id ?? "unassigned";
      const current = perUser.get(userKey) ?? {
        userId: task.assignee?.id ?? null,
        name: task.assignee?.name ?? "Unassigned",
        count: 0
      };
      current.count += 1;
      perUser.set(userKey, current);
    }

    const overdueTasks = tasks.filter((task) => task.status !== TaskStatus.DONE && task.dueDate < now);

    res.json({
      totalTasks: tasks.length,
      byStatus,
      overdueCount: overdueTasks.length,
      tasksPerUser: Array.from(perUser.values()).sort((a, b) => b.count - a.count),
      overdueTasks: overdueTasks.slice(0, 8)
    });
  })
);
