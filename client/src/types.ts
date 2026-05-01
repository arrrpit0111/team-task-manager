export type Role = "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type User = {
  id: string;
  name: string;
  email: string;
};

export type ProjectMember = {
  id: string;
  role: Role;
  joinedAt: string;
  user: User;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  currentUserRole: Role;
  members: ProjectMember[];
  _count: {
    tasks: number;
    members: number;
  };
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  assigneeId?: string | null;
  creatorId: string;
  assignee?: User | null;
  creator?: User;
  project?: Pick<Project, "id" | "name">;
};

export type DashboardData = {
  totalTasks: number;
  byStatus: Record<TaskStatus, number>;
  overdueCount: number;
  tasksPerUser: Array<{ userId: string | null; name: string; count: number }>;
  overdueTasks: Task[];
};
