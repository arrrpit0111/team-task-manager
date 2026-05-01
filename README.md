# TaskForge - Team Task Management App

Full-stack team task management web app built for the assignment: JWT auth, project roles, member management, task assignment, status tracking, dashboard analytics, PostgreSQL schema, and Railway deployment config.

## Stack

- Frontend: React 19, Vite, TypeScript, custom responsive CSS, lucide icons
- Backend: Node.js, Express, TypeScript, JWT, bcrypt, Zod validation
- Database: PostgreSQL with Prisma ORM and migrations
- Deployment: Railway Railpack via `railway.json`

## Features

- Signup/login with hashed passwords and JWT auth
- Project creation with creator assigned as `ADMIN`
- Admin controls to add/remove members and promote/demote roles
- Task creation with title, description, due date, priority, assignee, and status
- Member access limited to assigned tasks and status updates
- Dashboard totals, tasks by status, tasks per user, and overdue tasks
- Production server serves the built React app and REST API from one Railway service

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:5173`.

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp .env.example .env`. If Docker is not installed, paste a Railway/Postgres connection string into `DATABASE_URL` and skip the `docker compose` command.

Railway gives two kinds of Postgres URLs. A URL containing `postgres.railway.internal` only works from a service running inside Railway. For local development on your laptop, use Railway's public TCP proxy/Postgres URL, or run the included Docker Postgres service. For Railway public proxy URLs, append `?sslmode=require&sslaccept=accept_invalid_certs` so Prisma migrations can connect over SSL. The API runtime uses Prisma's `pg` adapter and configures Railway SSL in code.

Seeded accounts:

- Admin: `admin@example.com` / `Password123!`
- Member: `maya@example.com` / `Password123!`

## Production Check

```bash
npm run build
npm run railway:start
```

The API exposes `GET /api/health`, and the production server serves the frontend from `client/dist`.

## Railway Deployment

1. Push this repo to GitHub.
2. Create a Railway project from the GitHub repo.
3. Add a Railway PostgreSQL service and connect it to the web service.
4. Set environment variables on the web service:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `CLIENT_ORIGIN` can be omitted when the backend serves the built frontend from the same Railway service.
5. Railway will use `railway.json`:
   - Build command: `npm run build`
   - Start command: `npm run railway:start`

Railway currently uses Railpack for build detection and supports explicit build/start command overrides in service configuration: [Railpack docs](https://docs.railway.com/reference/railpack), [Build and Start Commands](https://docs.railway.com/builds/build-and-start-commands).

## API Overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `PATCH /api/projects/:projectId/members/:userId`
- `DELETE /api/projects/:projectId/members/:userId`
- `GET /api/tasks?projectId=...`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard?projectId=...`
