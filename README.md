# Mission Control Dashboard

Mission Control is a full-stack orchestration dashboard for projects, tasks, agents, scheduler automation, chat, execution logs, and artifact tracking.

## Stack

- Frontend: Next.js (Pages Router) + shadcn/ui + Tailwind
- Backend: Express + WebSocket (`ws`)
- DB: Prisma + SQLite (`better-sqlite3` adapter)
- Scheduling: `node-cron`
- Execution: local OpenClaw CLI / shell commands

## Features

- **Projects**: root/output paths, primary agent, git ref/settings/status
- **Tasks**: PLAN/BUILD/OPS with status flow `BACKLOG → PLANNED → IN_PROGRESS → BLOCKED → DONE`
- **Agents**: discovery from `~/.openclaw/openclaw.json`, assignment per project
- **Scheduler**: cron jobs, run-now, enable/disable, update/delete, run history
- **Web Chat**: project-aware chat, task creation from chat, markdown export, file attachments persisted to output path
- **Files/Outputs**: output directory browser with search + preview
- **Execution**: run tasks via OpenClaw CLI, live logs via WebSocket, artifact indexing from output directory diffs
- **Dashboard**: global overview and activity endpoints

## Setup

### 1) Install deps

```bash
npm install
```

### 2) Environment

Create `.env` (or reuse existing):

```env
DATABASE_URL="file:./dev.db"
```

Optional:

```env
OPENCLAW_CONFIG="/home/<user>/.openclaw/openclaw.json"
```

### 3) Prisma

```bash
npx prisma db push
```

### 4) Run backend + frontend

Terminal A (API on `:4000`):

```bash
npm run server
```

Terminal B (UI on `:3000`):

```bash
npm run dev
```

Open: `http://127.0.0.1:3000`

## Production build

```bash
npm run build
npm run start
```

## API quick checks

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/api/projects
curl http://127.0.0.1:4000/api/agents
```

## Notes

- Chat responses are executed via local `openclaw agent` command and streamed to clients over WebSocket.
- Task runs stream stdout/stderr events over `/ws` and persist full logs in DB.
- Artifact indexing uses file snapshots before/after task execution in each project output directory.
