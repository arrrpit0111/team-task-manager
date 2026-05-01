import bcrypt from "bcryptjs";
import { Priority, Role, TaskStatus } from "@prisma/client";
import { prisma } from "./lib/prisma.js";

const demoPassword = "Password123!";

const upsertUser = async (name: string, email: string) => {
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { name, email, passwordHash },
    select: { id: true, name: true, email: true }
  });
};

const main = async () => {
  const admin = await upsertUser("Arpit Singh", "admin@example.com");
  const designer = await upsertUser("Maya Shah", "maya@example.com");
  const engineer = await upsertUser("Kabir Rao", "kabir@example.com");

  let project = await prisma.project.findFirst({
    where: { name: "Launch Operations", createdById: admin.id }
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "Launch Operations",
        description: "Plan and track all launch-week work across product, design, and engineering.",
        createdById: admin.id
      }
    });
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: { role: Role.ADMIN },
    create: { projectId: project.id, userId: admin.id, role: Role.ADMIN }
  });

  for (const member of [designer, engineer]) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: member.id } },
      update: { role: Role.MEMBER },
      create: { projectId: project.id, userId: member.id, role: Role.MEMBER }
    });
  }

  const titles = [
    "Finalize onboarding checklist",
    "Prepare dashboard review",
    "QA role-based task permissions",
    "Publish launch notes"
  ];

  await prisma.task.deleteMany({
    where: {
      projectId: project.id,
      title: { in: titles }
    }
  });

  const now = Date.now();
  const tasks = [
    {
      title: titles[0],
      description: "Polish first-run steps and make sure empty states guide the team.",
      dueDate: new Date(now + 1000 * 60 * 60 * 24 * 2),
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      assigneeId: designer.id
    },
    {
      title: titles[1],
      description: "Check KPI cards, status totals, overdue work, and per-user workload.",
      dueDate: new Date(now + 1000 * 60 * 60 * 24 * 4),
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      assigneeId: admin.id
    },
    {
      title: titles[2],
      description: "Verify members can only update their assigned task status.",
      dueDate: new Date(now - 1000 * 60 * 60 * 24),
      priority: Priority.URGENT,
      status: TaskStatus.TODO,
      assigneeId: engineer.id
    },
    {
      title: titles[3],
      description: "Draft a short, practical release note for stakeholders.",
      dueDate: new Date(now + 1000 * 60 * 60 * 24 * 6),
      priority: Priority.LOW,
      status: TaskStatus.DONE,
      assigneeId: designer.id
    }
  ];

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        ...task,
        projectId: project.id,
        creatorId: admin.id
      }
    });
  }

  console.log("Seed complete");
  console.log("Admin login: admin@example.com / Password123!");
  console.log("Member login: maya@example.com / Password123!");
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
