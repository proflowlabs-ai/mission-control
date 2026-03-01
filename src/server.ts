import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import http from "node:http";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "./generated/prisma/client";
import { getAgents } from "./lib/openclaw";
import { SchedulerService, isValidCron } from "./services/scheduler";
import { TaskExecutor } from "./services/taskExecutor";
import { websocketService } from "./services/websocket";
import type { AgentDescriptor } from "./types";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });
const app = express();
const server = http.createServer(app);
const taskExecutor = new TaskExecutor(prisma);
const scheduler = new SchedulerService(prisma, taskExecutor);

let cachedAgents: AgentDescriptor[] = [];

const allowedTransitions: Record<string, string[]> = {
  BACKLOG: ["PLANNED", "IN_PROGRESS", "BLOCKED"],
  PLANNED: ["IN_PROGRESS", "BLOCKED", "DONE"],
  IN_PROGRESS: ["BLOCKED", "DONE", "PLANNED"],
  BLOCKED: ["PLANNED", "IN_PROGRESS"],
  DONE: ["PLANNED"],
};

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/projects", async (_req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ projects });
});

app.post("/api/projects", async (req, res) => {
  const { name, description, rootPath, outputPath, primaryAgentId } = req.body;
  const project = await prisma.project.create({
    data: { name, description, rootPath, outputPath, primaryAgentId },
  });
  res.status(201).json({ project });
});

app.get("/api/projects/:id", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  return res.json({ project });
});

app.put("/api/projects/:id", async (req, res) => {
  const { name, description, rootPath, outputPath, primaryAgentId } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { name, description, rootPath, outputPath, primaryAgentId },
  });
  res.json({ project });
});

app.delete("/api/projects/:id", async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

app.get("/api/tasks", async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const tasks = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json({ tasks });
});

app.post("/api/tasks", async (req, res) => {
  const { projectId, title, description, type, status, priority, assignedAgentId, expectedDeliverables } = req.body;
  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      type,
      status,
      priority,
      assignedAgentId,
      expectedDeliverables,
    },
  });
  res.status(201).json({ task });
});

app.get("/api/tasks/:id", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  return res.json({ task });
});

app.put("/api/tasks/:id", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (req.body.status && req.body.status !== existing.status) {
    const allowed = allowedTransitions[existing.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status transition ${existing.status} -> ${req.body.status}` });
    }
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: req.body,
  });

  return res.json({ task });
});

app.delete("/api/tasks/:id", async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

app.post("/api/tasks/:id/run", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const command = (req.body.command as string | undefined) ?? "echo task-run";
  const cwd = (req.body.cwd as string | undefined) ?? task.project.rootPath;

  const runId = await taskExecutor.executeTask(task.id, command, cwd);
  return res.status(202).json({ runId, status: "RUNNING" });
});

app.get("/api/tasks/:id/runs", async (req, res) => {
  const runs = await prisma.taskRun.findMany({
    where: { taskId: req.params.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ runs });
});

app.get("/api/agents", (_req, res) => {
  res.json({ agents: cachedAgents });
});

app.post("/api/scheduler", async (req, res) => {
  const { projectId, name, description, jobType, cronExpression, timezone, enabled, targetTaskId } = req.body;

  if (!isValidCron(cronExpression)) {
    return res.status(400).json({ error: "Invalid cron expression" });
  }

  const job = await prisma.cronJob.create({
    data: {
      projectId,
      name,
      description,
      jobType,
      cronExpression,
      timezone,
      enabled,
      targetTaskId,
    },
  });

  if (job.enabled) {
    scheduler.scheduleJob(job.id, job.cronExpression, job.timezone);
  }

  return res.status(201).json({ job });
});

app.get("/api/scheduler", async (_req, res) => {
  const jobs = await prisma.cronJob.findMany({ orderBy: { createdAt: "desc" }, include: { runs: true } });
  res.json({ jobs });
});

app.post("/api/scheduler/:id/run-now", async (req, res) => {
  const job = await prisma.cronJob.findUnique({ where: { id: req.params.id } });
  if (!job) {
    return res.status(404).json({ error: "Scheduler job not found" });
  }

  void scheduler.executeJob(job.id);
  return res.status(202).json({ status: "RUNNING" });
});

app.put("/api/scheduler/:id/enable", async (req, res) => {
  const job = await prisma.cronJob.update({
    where: { id: req.params.id },
    data: { enabled: true },
  });
  scheduler.scheduleJob(job.id, job.cronExpression, job.timezone);
  res.json({ job });
});

app.put("/api/scheduler/:id/disable", async (req, res) => {
  const job = await prisma.cronJob.update({
    where: { id: req.params.id },
    data: { enabled: false },
  });
  scheduler.stopJob(job.id);
  res.json({ job });
});

app.get("/api/scheduler/:id/runs", async (req, res) => {
  const runs = await prisma.schedulerJobRun.findMany({
    where: { jobId: req.params.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ runs });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
});

const start = async (): Promise<void> => {
  cachedAgents = await getAgents();
  websocketService.setup(server);
  await scheduler.start();

  server.listen(4000, "0.0.0.0", () => {
    console.log("Mission Control API listening on http://0.0.0.0:4000");
  });
};

void start();
