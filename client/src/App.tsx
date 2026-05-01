import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { apiRequest, ApiError } from "./api";
import type { DashboardData, Priority, Project, Role, Task, TaskStatus, User } from "./types";

const statusOrder: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const statusLabels: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done"
};
const priorityLabels: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent"
};
const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  MEMBER: "Member"
};

const emptyDashboard: DashboardData = {
  totalTasks: 0,
  byStatus: { TODO: 0, IN_PROGRESS: 0, DONE: 0 },
  overdueCount: 0,
  tasksPerUser: [],
  overdueTasks: []
};

const nextDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));

const toInputDate = (value: string) => new Date(value).toISOString().slice(0, 10);

const isOverdue = (task: Task) => task.status !== "DONE" && new Date(task.dueDate) < new Date();

type ActiveView = "dashboard" | "projects" | "tasks" | "team";

type Notice = {
  type: "success" | "error";
  message: string;
};

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("taskforge_token"));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("taskforge_user");
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ email: "", role: "MEMBER" as Role });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: nextDate(),
    priority: "MEDIUM" as Priority,
    assigneeId: ""
  });

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const isAdmin = selectedProject?.currentUserRole === "ADMIN";

  const tasksByStatus = useMemo(
    () =>
      statusOrder.reduce<Record<TaskStatus, Task[]>>(
        (acc, status) => {
          acc[status] = tasks.filter((task) => task.status === status);
          return acc;
        },
        { TODO: [], IN_PROGRESS: [], DONE: [] }
      ),
    [tasks]
  );

  const maxUserTasks = Math.max(1, ...dashboard.tasksPerUser.map((item) => item.count));

  const flash = (message: string, type: Notice["type"] = "success") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3200);
  };

  const apiToken = token;

  const refreshTasks = async (projectId: string, authToken = apiToken) => {
    if (!authToken || !projectId) {
      setTasks([]);
      return;
    }

    const data = await apiRequest<{ tasks: Task[] }>(`/api/tasks?projectId=${projectId}`, {
      token: authToken
    });
    setTasks(data.tasks);
  };

  const refreshDashboard = async (projectId: string, authToken = apiToken) => {
    if (!authToken || !projectId) {
      setDashboard(emptyDashboard);
      return;
    }

    const data = await apiRequest<DashboardData>(`/api/dashboard?projectId=${projectId}`, {
      token: authToken
    });
    setDashboard(data);
  };

  const refreshWorkspace = async (preferredProjectId = selectedProjectId, authToken = apiToken) => {
    if (!authToken) {
      return;
    }

    const data = await apiRequest<{ projects: Project[] }>("/api/projects", { token: authToken });
    setProjects(data.projects);

    const nextProjectId =
      data.projects.find((project) => project.id === preferredProjectId)?.id ?? data.projects[0]?.id ?? "";
    setSelectedProjectId(nextProjectId);

    if (nextProjectId) {
      await Promise.all([refreshTasks(nextProjectId, authToken), refreshDashboard(nextProjectId, authToken)]);
    } else {
      setTasks([]);
      setDashboard(emptyDashboard);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    const bootstrap = async () => {
      try {
        setLoading(true);
        const data = await apiRequest<{ user: User }>("/api/auth/me", { token });
        setUser(data.user);
        localStorage.setItem("taskforge_user", JSON.stringify(data.user));
        await refreshWorkspace("", token);
      } catch (error) {
        logout();
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const data = await apiRequest<{ user: User; token: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(authForm)
      });
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("taskforge_token", data.token);
      localStorage.setItem("taskforge_user", JSON.stringify(data.user));
      flash(authMode === "login" ? "Welcome back." : "Account created.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Authentication failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProjects([]);
    setSelectedProjectId("");
    setTasks([]);
    setDashboard(emptyDashboard);
    localStorage.removeItem("taskforge_token");
    localStorage.removeItem("taskforge_user");
  };

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setLoading(true);
    try {
      await Promise.all([refreshTasks(projectId), refreshDashboard(projectId)]);
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not load project", "error");
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      const data = await apiRequest<{ project: Project }>("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify(projectForm)
      });
      setProjectForm({ name: "", description: "" });
      await refreshWorkspace(data.project.id);
      flash("Project created.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not create project", "error");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest(`/api/projects/${selectedProjectId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify(memberForm)
      });
      setMemberForm({ email: "", role: "MEMBER" });
      await refreshWorkspace(selectedProjectId);
      flash("Member updated.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not update member", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest(`/api/projects/${selectedProjectId}/members/${memberId}`, {
        method: "DELETE",
        token
      });
      await refreshWorkspace(selectedProjectId);
      flash("Member removed.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not remove member", "error");
    } finally {
      setBusy(false);
    }
  };

  const updateMemberRole = async (memberId: string, role: Role) => {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest(`/api/projects/${selectedProjectId}/members/${memberId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role })
      });
      await refreshWorkspace(selectedProjectId);
      flash("Role updated.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not update role", "error");
    } finally {
      setBusy(false);
    }
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/api/tasks", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...taskForm,
          projectId: selectedProjectId,
          assigneeId: taskForm.assigneeId || null,
          dueDate: taskForm.dueDate
        })
      });
      setTaskForm({
        title: "",
        description: "",
        dueDate: nextDate(),
        priority: "MEDIUM",
        assigneeId: selectedProject?.members[0]?.user.id ?? ""
      });
      await Promise.all([refreshTasks(selectedProjectId), refreshDashboard(selectedProjectId)]);
      flash("Task created.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not create task", "error");
    } finally {
      setBusy(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    setBusy(true);
    try {
      await apiRequest(`/api/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status })
      });
      await Promise.all([refreshTasks(selectedProjectId), refreshDashboard(selectedProjectId)]);
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not update task", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/tasks/${taskId}`, {
        method: "DELETE",
        token
      });
      await Promise.all([refreshTasks(selectedProjectId), refreshDashboard(selectedProjectId)]);
      flash("Task deleted.");
    } catch (error) {
      flash(error instanceof ApiError ? error.message : "Could not delete task", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!token || !user) {
    return (
      <AuthScreen
        authMode={authMode}
        authForm={authForm}
        busy={busy}
        notice={notice}
        onModeChange={setAuthMode}
        onSubmit={handleAuth}
        onChange={setAuthForm}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">T</div>
          <div>
            <h1>TaskForge</h1>
            <p>Team Task Manager</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          <NavButton icon={<LayoutDashboard />} label="Dashboard" active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} />
          <NavButton icon={<FolderKanban />} label="Projects" active={activeView === "projects"} onClick={() => setActiveView("projects")} />
          <NavButton icon={<ClipboardList />} label="Tasks" active={activeView === "tasks"} onClick={() => setActiveView("tasks")} />
          <NavButton icon={<Users />} label="Team" active={activeView === "team"} onClick={() => setActiveView("team")} />
        </nav>

        <div className="sidebar-footer">
          <div className="profile-chip">
            <span>{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button className="ghost-button full" onClick={logout} type="button">
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Workspace Overview</span>
            <h2>{selectedProject ? selectedProject.name : "Projects Dashboard"}</h2>
            <p>
              Hello {user.name}
              {selectedProject ? <span className={`role-pill ${selectedProject.currentUserRole.toLowerCase()}`}>{roleLabels[selectedProject.currentUserRole]}</span> : null}
            </p>
          </div>

          <div className="topbar-actions">
            <select
              value={selectedProjectId}
              onChange={(event) => void handleProjectSelect(event.target.value)}
              disabled={!projects.length}
              aria-label="Select project"
            >
              {!projects.length ? <option>No projects yet</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button className="primary-button compact" onClick={() => void refreshWorkspace()} disabled={loading || busy} type="button">
              <RefreshCw size={17} />
              Refresh
            </button>
          </div>
        </header>

        {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}
        {loading ? (
          <div className="loading-panel">
            <Loader2 className="spin" />
            Loading workspace
          </div>
        ) : null}

        {!loading && activeView === "dashboard" ? (
          <DashboardView
            dashboard={dashboard}
            maxUserTasks={maxUserTasks}
            selectedProject={selectedProject}
            onCreateFirst={() => setActiveView("projects")}
          />
        ) : null}

        {!loading && activeView === "projects" ? (
          <ProjectsView
            projects={projects}
            selectedProject={selectedProject}
            projectForm={projectForm}
            memberForm={memberForm}
            busy={busy}
            isAdmin={isAdmin}
            onProjectFormChange={setProjectForm}
            onMemberFormChange={setMemberForm}
            onCreateProject={createProject}
            onAddMember={addMember}
            onSelectProject={(projectId) => void handleProjectSelect(projectId)}
            onRemoveMember={(memberId) => void removeMember(memberId)}
            onRoleChange={(memberId, role) => void updateMemberRole(memberId, role)}
          />
        ) : null}

        {!loading && activeView === "tasks" ? (
          <TasksView
            user={user}
            tasksByStatus={tasksByStatus}
            selectedProject={selectedProject}
            taskForm={taskForm}
            busy={busy}
            isAdmin={isAdmin}
            onTaskFormChange={setTaskForm}
            onCreateTask={createTask}
            onStatusChange={(taskId, status) => void updateTaskStatus(taskId, status)}
            onDeleteTask={(taskId) => void deleteTask(taskId)}
          />
        ) : null}

        {!loading && activeView === "team" ? (
          <TeamView
            selectedProject={selectedProject}
            tasks={tasks}
            dashboard={dashboard}
            isAdmin={isAdmin}
            memberForm={memberForm}
            busy={busy}
            onMemberFormChange={setMemberForm}
            onAddMember={addMember}
            onRoleChange={(memberId, role) => void updateMemberRole(memberId, role)}
            onRemoveMember={(memberId) => void removeMember(memberId)}
          />
        ) : null}
      </main>
    </div>
  );
}

function AuthScreen({
  authMode,
  authForm,
  busy,
  notice,
  onModeChange,
  onSubmit,
  onChange
}: {
  authMode: "login" | "signup";
  authForm: { name: string; email: string; password: string };
  busy: boolean;
  notice: Notice | null;
  onModeChange: (mode: "login" | "signup") => void;
  onSubmit: (event: FormEvent) => void;
  onChange: (form: { name: string; email: string; password: string }) => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand-block large">
          <div className="brand-mark">T</div>
          <div>
            <h1>TaskForge</h1>
            <p>Team Task Manager</p>
          </div>
        </div>
        <h2>Plan, assign, and ship as one team.</h2>
        <div className="auth-stats">
          <span>JWT Auth</span>
          <span>Admin Roles</span>
          <span>Live Dashboard</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-tabs">
          <button className={authMode === "login" ? "active" : ""} onClick={() => onModeChange("login")} type="button">
            Login
          </button>
          <button className={authMode === "signup" ? "active" : ""} onClick={() => onModeChange("signup")} type="button">
            Signup
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <div>
            <span className="eyebrow">{authMode === "login" ? "Welcome Back" : "Create Account"}</span>
            <h2>{authMode === "login" ? "Sign in to your workspace" : "Start a new workspace"}</h2>
          </div>

          {authMode === "signup" ? (
            <label>
              Name
              <input
                value={authForm.name}
                onChange={(event) => onChange({ ...authForm, name: event.target.value })}
                placeholder="Arpit Singh"
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              value={authForm.email}
              onChange={(event) => onChange({ ...authForm, email: event.target.value })}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              value={authForm.password}
              onChange={(event) => onChange({ ...authForm, password: event.target.value })}
              placeholder="Minimum 8 characters"
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}

          <button className="primary-button" disabled={busy} type="submit">
            {busy ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
            {authMode === "login" ? "Secure Login" : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function DashboardView({
  dashboard,
  maxUserTasks,
  selectedProject,
  onCreateFirst
}: {
  dashboard: DashboardData;
  maxUserTasks: number;
  selectedProject: Project | null;
  onCreateFirst: () => void;
}) {
  if (!selectedProject) {
    return (
      <section className="empty-state">
        <FolderKanban size={38} />
        <h3>Create your first project</h3>
        <p>Your dashboard will light up as soon as a project has tasks and teammates.</p>
        <button className="primary-button compact" onClick={onCreateFirst} type="button">
          <Plus size={17} />
          New Project
        </button>
      </section>
    );
  }

  const metrics = [
    { label: "Total", value: dashboard.totalTasks, icon: <BarChart3 />, tone: "blue" },
    { label: "To Do", value: dashboard.byStatus.TODO, icon: <ClipboardList />, tone: "slate" },
    { label: "In Progress", value: dashboard.byStatus.IN_PROGRESS, icon: <RefreshCw />, tone: "amber" },
    { label: "Done", value: dashboard.byStatus.DONE, icon: <CheckCircle2 />, tone: "green" },
    { label: "Overdue", value: dashboard.overdueCount, icon: <AlertTriangle />, tone: "red" }
  ];

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Performance Snapshot</span>
            <h3>Task health</h3>
          </div>
        </div>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className={`metric-card ${metric.tone}`} key={metric.label}>
              <span>{metric.icon}</span>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="split-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Workload</span>
              <h3>Tasks per user</h3>
            </div>
          </div>
          <div className="bar-list">
            {dashboard.tasksPerUser.length ? (
              dashboard.tasksPerUser.map((item) => (
                <div className="bar-row" key={item.userId ?? "unassigned"}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.count} tasks</span>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: `${(item.count / maxUserTasks) * 100}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No assigned tasks yet.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Attention</span>
              <h3>Overdue tasks</h3>
            </div>
          </div>
          <div className="mini-list">
            {dashboard.overdueTasks.length ? (
              dashboard.overdueTasks.map((task) => (
                <div className="mini-row" key={task.id}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>{task.title}</strong>
                    <span>{formatDate(task.dueDate)} · {task.assignee?.name ?? "Unassigned"}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Nothing overdue.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function ProjectsView({
  projects,
  selectedProject,
  projectForm,
  memberForm,
  busy,
  isAdmin,
  onProjectFormChange,
  onMemberFormChange,
  onCreateProject,
  onAddMember,
  onSelectProject,
  onRemoveMember,
  onRoleChange
}: {
  projects: Project[];
  selectedProject: Project | null;
  projectForm: { name: string; description: string };
  memberForm: { email: string; role: Role };
  busy: boolean;
  isAdmin: boolean;
  onProjectFormChange: (form: { name: string; description: string }) => void;
  onMemberFormChange: (form: { email: string; role: Role }) => void;
  onCreateProject: (event: FormEvent) => void;
  onAddMember: (event: FormEvent) => void;
  onSelectProject: (projectId: string) => void;
  onRemoveMember: (memberId: string) => void;
  onRoleChange: (memberId: string, role: Role) => void;
}) {
  return (
    <div className="stack">
      <section className="panel accent-top">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Project Management</span>
            <h3>Create projects and manage teams</h3>
          </div>
        </div>
        <form className="project-form" onSubmit={onCreateProject}>
          <input
            value={projectForm.name}
            onChange={(event) => onProjectFormChange({ ...projectForm, name: event.target.value })}
            placeholder="Project name"
            required
          />
          <input
            value={projectForm.description}
            onChange={(event) => onProjectFormChange({ ...projectForm, description: event.target.value })}
            placeholder="Short description"
          />
          <button className="primary-button" disabled={busy} type="submit">
            <Plus size={18} />
            Create Project
          </button>
        </form>
      </section>

      <section className="split-grid wide-left">
        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Portfolio</span>
              <h3>Assigned projects</h3>
            </div>
          </div>
          <div className="project-list">
            {projects.length ? (
              projects.map((project) => (
                <button
                  className={`project-row ${selectedProject?.id === project.id ? "active" : ""}`}
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  type="button"
                >
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.description || "No description"}</span>
                  </div>
                  <small>{project._count.tasks} tasks · {project._count.members} people</small>
                </button>
              ))
            ) : (
              <p className="muted">No projects yet.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Roster</span>
              <h3>{selectedProject ? selectedProject.name : "Select a project"}</h3>
            </div>
            {selectedProject ? <span className={`role-pill ${selectedProject.currentUserRole.toLowerCase()}`}>{roleLabels[selectedProject.currentUserRole]}</span> : null}
          </div>

          {selectedProject ? (
            <>
              {isAdmin ? (
                <form className="member-form" onSubmit={onAddMember}>
                  <input
                    value={memberForm.email}
                    onChange={(event) => onMemberFormChange({ ...memberForm, email: event.target.value })}
                    placeholder="teammate@example.com"
                    type="email"
                    required
                  />
                  <select
                    value={memberForm.role}
                    onChange={(event) => onMemberFormChange({ ...memberForm, role: event.target.value as Role })}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button className="success-button" disabled={busy} type="submit">
                    <UserPlus size={18} />
                    Add Member
                  </button>
                </form>
              ) : null}

              <MemberTable
                project={selectedProject}
                isAdmin={isAdmin}
                busy={busy}
                onRoleChange={onRoleChange}
                onRemoveMember={onRemoveMember}
              />
            </>
          ) : (
            <p className="muted">Create a project to start building a roster.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function TasksView({
  user,
  tasksByStatus,
  selectedProject,
  taskForm,
  busy,
  isAdmin,
  onTaskFormChange,
  onCreateTask,
  onStatusChange,
  onDeleteTask
}: {
  user: User;
  tasksByStatus: Record<TaskStatus, Task[]>;
  selectedProject: Project | null;
  taskForm: { title: string; description: string; dueDate: string; priority: Priority; assigneeId: string };
  busy: boolean;
  isAdmin: boolean;
  onTaskFormChange: (form: { title: string; description: string; dueDate: string; priority: Priority; assigneeId: string }) => void;
  onCreateTask: (event: FormEvent) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  if (!selectedProject) {
    return (
      <section className="empty-state">
        <ClipboardList size={38} />
        <h3>No project selected</h3>
        <p>Tasks appear after you create or join a project.</p>
      </section>
    );
  }

  return (
    <div className="stack">
      {isAdmin ? (
        <section className="panel accent-top teal">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Task Management</span>
              <h3>Create and assign tasks</h3>
            </div>
          </div>
          <form className="task-form" onSubmit={onCreateTask}>
            <input
              value={taskForm.title}
              onChange={(event) => onTaskFormChange({ ...taskForm, title: event.target.value })}
              placeholder="Task title"
              required
            />
            <input
              value={taskForm.description}
              onChange={(event) => onTaskFormChange({ ...taskForm, description: event.target.value })}
              placeholder="Description"
            />
            <input
              value={taskForm.dueDate}
              onChange={(event) => onTaskFormChange({ ...taskForm, dueDate: event.target.value })}
              type="date"
              required
            />
            <select
              value={taskForm.priority}
              onChange={(event) => onTaskFormChange({ ...taskForm, priority: event.target.value as Priority })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <select
              value={taskForm.assigneeId}
              onChange={(event) => onTaskFormChange({ ...taskForm, assigneeId: event.target.value })}
            >
              <option value="">Unassigned</option>
              {selectedProject.members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.name}
                </option>
              ))}
            </select>
            <button className="primary-button" disabled={busy} type="submit">
              <Plus size={18} />
              Create Task
            </button>
          </form>
        </section>
      ) : (
        <section className="member-note">
          <ShieldCheck size={20} />
          <span>{roleLabels[selectedProject.currentUserRole]} access · Assigned tasks only</span>
        </section>
      )}

      <section className="kanban">
        {statusOrder.map((status) => (
          <article className="column" key={status}>
            <div className="column-header">
              <h3>{statusLabels[status]}</h3>
              <span>{tasksByStatus[status].length}</span>
            </div>
            <div className="task-list">
              {tasksByStatus[status].length ? (
                tasksByStatus[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={user.id}
                    isAdmin={isAdmin}
                    busy={busy}
                    onStatusChange={onStatusChange}
                    onDeleteTask={onDeleteTask}
                  />
                ))
              ) : (
                <p className="muted small">No tasks here.</p>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function TeamView({
  selectedProject,
  tasks,
  dashboard,
  isAdmin,
  memberForm,
  busy,
  onMemberFormChange,
  onAddMember,
  onRoleChange,
  onRemoveMember
}: {
  selectedProject: Project | null;
  tasks: Task[];
  dashboard: DashboardData;
  isAdmin: boolean;
  memberForm: { email: string; role: Role };
  busy: boolean;
  onMemberFormChange: (form: { email: string; role: Role }) => void;
  onAddMember: (event: FormEvent) => void;
  onRoleChange: (memberId: string, role: Role) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  if (!selectedProject) {
    return (
      <section className="empty-state">
        <Users size={38} />
        <h3>No team yet</h3>
        <p>Create a project before adding members.</p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Team</span>
            <h3>{selectedProject.name}</h3>
          </div>
          <span className="count-pill">{selectedProject.members.length} members</span>
        </div>

        {isAdmin ? (
          <form className="member-form" onSubmit={onAddMember}>
            <input
              value={memberForm.email}
              onChange={(event) => onMemberFormChange({ ...memberForm, email: event.target.value })}
              placeholder="teammate@example.com"
              type="email"
              required
            />
            <select
              value={memberForm.role}
              onChange={(event) => onMemberFormChange({ ...memberForm, role: event.target.value as Role })}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button className="success-button" disabled={busy} type="submit">
              <UserPlus size={18} />
              Add Member
            </button>
          </form>
        ) : null}

        <MemberTable
          project={selectedProject}
          isAdmin={isAdmin}
          busy={busy}
          onRoleChange={onRoleChange}
          onRemoveMember={onRemoveMember}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Capacity</span>
            <h3>Current ownership</h3>
          </div>
        </div>
        <div className="team-grid">
          {selectedProject.members.map((member) => {
            const ownedTasks = tasks.filter((task) => task.assignee?.id === member.user.id);
            const completed = ownedTasks.filter((task) => task.status === "DONE").length;
            const stat = dashboard.tasksPerUser.find((item) => item.userId === member.user.id);
            return (
              <article className="team-card" key={member.id}>
                <div className="avatar">{member.user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{member.user.name}</strong>
                  <span>{member.user.email}</span>
                </div>
                <div className="team-card-stats">
                  <span>{stat?.count ?? 0} tasks</span>
                  <span>{completed} done</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MemberTable({
  project,
  isAdmin,
  busy,
  onRoleChange,
  onRemoveMember
}: {
  project: Project;
  isAdmin: boolean;
  busy: boolean;
  onRoleChange: (memberId: string, role: Role) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            {isAdmin ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {project.members.map((member) => (
            <tr key={member.id}>
              <td>{member.user.name}</td>
              <td>{member.user.email}</td>
              <td>
                {isAdmin ? (
                  <select
                    value={member.role}
                    onChange={(event) => onRoleChange(member.user.id, event.target.value as Role)}
                    disabled={busy}
                    aria-label={`Role for ${member.user.name}`}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <span className={`role-pill ${member.role.toLowerCase()}`}>{roleLabels[member.role]}</span>
                )}
              </td>
              {isAdmin ? (
                <td>
                  <button className="danger-icon" onClick={() => onRemoveMember(member.user.id)} disabled={busy} type="button" aria-label={`Remove ${member.user.name}`}>
                    <Trash2 size={16} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({
  task,
  currentUserId,
  isAdmin,
  busy,
  onStatusChange,
  onDeleteTask
}: {
  task: Task;
  currentUserId: string;
  isAdmin: boolean;
  busy: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const canUpdateStatus = isAdmin || task.assignee?.id === currentUserId;

  return (
    <article className={`task-card priority-${task.priority.toLowerCase()} ${isOverdue(task) ? "overdue" : ""}`}>
      <div className="task-topline">
        <span className={`priority ${task.priority.toLowerCase()}`}>{priorityLabels[task.priority]}</span>
        {isAdmin ? (
          <button className="danger-icon subtle" onClick={() => onDeleteTask(task.id)} disabled={busy} type="button" aria-label={`Delete ${task.title}`}>
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      <h4>{task.title}</h4>
      {task.description ? <p>{task.description}</p> : null}
      <div className="task-meta">
        <span>
          <CalendarDays size={15} />
          {formatDate(task.dueDate)}
        </span>
        <span>{task.assignee?.name ?? "Unassigned"}</span>
      </div>
      <select
        value={task.status}
        onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)}
        disabled={!canUpdateStatus || busy}
        aria-label={`Status for ${task.title}`}
      >
        {statusOrder.map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
    </article>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}
