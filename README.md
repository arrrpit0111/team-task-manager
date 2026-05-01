# TaskForge - Team Task Management App 🚀

Full-stack team task management web app with JWT authentication, role-based project workflows, member management, task assignment, status tracking, dashboard analytics, and one-service Railway deployment.

## 🔗 Live Links

- GitHub Repository: [arrrpit0111/team-task-manager](https://github.com/arrrpit0111/team-task-manager)
- Live Application: [team-task-manager-production-502c.up.railway.app](https://team-task-manager-production-502c.up.railway.app/)

## 🧰 Stack

- Frontend: React, Vite, TypeScript, custom responsive CSS
- Backend: Node.js, Express, TypeScript, JWT, bcryptjs, Zod
- Database: PostgreSQL with Prisma ORM
- Deployment: Railway using `railway.json` (single service)

## 🧩 Easy Stack (Popular + Beginner Friendly)

- UI: React + Vite + TypeScript (fast and clean frontend setup)
- API: Express + JWT auth (simple route-based backend)
- DB: PostgreSQL + Prisma (popular SQL + modern ORM)
- Deploy: Railway (easy single-service deployment)

## ✨ Features

- Signup and login with hashed passwords and JWT auth
- Project creation with role-aware access (`ADMIN` and `MEMBER`)
- Admin controls to add/remove members and change roles
- Task creation with title, description, due date, priority, assignee, and status
- Members can update status for tasks assigned to them
- Dashboard analytics: totals, tasks by status, tasks per user, overdue tasks
- Production server serves both frontend and backend from one Railway service

## 🗂️ Project Structure

```text
team-task-manager/
├── client/                  # React + Vite frontend (TypeScript)
│   └── src/main.tsx
├── server/                  # API routes, middleware, Prisma setup
│   ├── src/routes/
│   ├── src/middleware/
│   └── prisma/schema.prisma
├── docker-compose.yml       # Local PostgreSQL service
├── railway.json             # Railway build/start config
├── package.json             # Root workspace scripts
└── README.md
```

## ⚙️ Local Setup

1. Install dependencies:

```bash
npm install
```

1. Create `.env` in project root:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/team_task_manager
JWT_SECRET=your_super_secret_key_here
CLIENT_ORIGIN=http://localhost:5173
```

1. Start PostgreSQL:

```bash
docker compose up -d postgres
```

1. Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

1. Seed demo data (optional but recommended):

```bash
npm run db:seed
```

1. Start frontend + backend:

```bash
npm run dev
```

Open `http://localhost:5173`.

## ✅ Demo Login

- Admin: `admin@example.com` / `Password123!`
- Member: `maya@example.com` / `Password123!`

## ✅ Production Check

```bash
npm run build
npm run railway:start
```

- API health endpoint: `GET /api/health`
- Production server serves frontend from `client/dist`

## 🚂 Railway Deployment (Single Service)

1. Push this repo to GitHub
2. Create Railway project from that repo
3. Add a Railway PostgreSQL service
4. Add environment variables in Railway:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `CLIENT_ORIGIN` (optional for same-origin setup)
5. Deploy

Railway config is already defined:

- Build command: `npm run build`
- Start command: `npm run railway:start`
- Config file: `railway.json`

## 📡 API Overview

Base URL: `/api`

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Users

- `GET /api/users/search?email=...`

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `PATCH /api/projects/:projectId/members/:userId`
- `DELETE /api/projects/:projectId/members/:userId`

### Tasks

- `GET /api/tasks?projectId=...`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`

### Dashboard

- `GET /api/dashboard?projectId=...`

## 📝 Notes

- This project uses PostgreSQL + Prisma (not MongoDB + Mongoose)
- Frontend and backend are deployed together under one Railway domain
- For local development with Railway Postgres, use a public connection URL (not `postgres.railway.internal`)

