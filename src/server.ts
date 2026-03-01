import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "./generated/prisma/client";
import { getAgents } from "./lib/openclaw";
import { SchedulerService, isValidCron } from "./services/scheduler";
import { TaskExecutor } from "./services/taskExecutor";
import { websocketService } from "./services/websocket";
import type { AgentDescriptor } from "./types";

const execFileAsync = promisify(execFile);
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

const toNullableString = (value: unknown, field: string): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
};

const toSettingsJsonString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      throw new Error("settings must be valid JSON");
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      throw new Error("settings must be JSON-serializable");
    }
  }

  throw new Error("settings must be a JSON string or object");
};

const withSafeSettings = <T extends { settings: string | null }>(project: T): T => {
  if (!project.settings) return project;
  try {
    JSON.parse(project.settings);
    return project;
  } catch {
    return { ...project, settings: "{}" };
  }
};

app.use(express.json({ limit: "15mb" }));
app.use(cors());

app.get("/health", async (_req, res) => {
  const runningTaskRuns = await prisma.taskRun.count({ where: { status: "RUNNING" } });
  const blockedTasks = await prisma.task.count({ where: { status: "BLOCKED" } });
  res.json({ status: "ok", timestamp: new Date().toISOString(), runningTaskRuns, blockedTasks });
});

app.get("/api/dashboard/activity", async (_req, res) => {
  const [taskRuns, schedulerRuns, messages] = await Promise.all([
    prisma.taskRun.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.schedulerJobRun.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const timeline = [
    ...taskRuns.map((r) => ({ type: "TASK_RUN", id: r.id, status: r.status, at: r.createdAt })),
    ...schedulerRuns.map((r) => ({ type: "SCHEDULER_RUN", id: r.id, status: r.status, at: r.createdAt })),
    ...messages.map((m) => ({ type: "CHAT", id: m.id, role: m.role, at: m.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  res.json({ timeline: timeline.slice(0, 50) });
});

app.get("/api/projects", async (_req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ projects });
});

app.post("/api/projects", async (req, res) => {
  const { name, description, rootPath, outputPath, primaryAgentId, gitRef, settings, status } = req.body;

  let parsedGitRef: string | null | undefined;
  let parsedSettings: string | null | undefined;
  let parsedStatus: string | null | undefined;

  try {
    parsedGitRef = toNullableString(gitRef, "gitRef");
    parsedSettings = toSettingsJsonString(settings);
    parsedStatus = toNullableString(status, "status");
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request body" });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      rootPath,
      outputPath,
      primaryAgentId,
      gitRef: parsedGitRef,
      settings: parsedSettings,
      status: parsedStatus,
    },
  });
  res.status(201).json({ project: withSafeSettings(project) });
});

app.get("/api/projects/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { agents: { include: { agent: true } }, tasks: true, jobs: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });
  return res.json({ project: withSafeSettings(project) });
});

app.put("/api/projects/:id", async (req, res) => {
  const { name, description, rootPath, outputPath, primaryAgentId, gitRef, settings, status } = req.body;

  let parsedGitRef: string | null | undefined;
  let parsedSettings: string | null | undefined;
  let parsedStatus: string | null | undefined;

  try {
    parsedGitRef = toNullableString(gitRef, "gitRef");
    parsedSettings = toSettingsJsonString(settings);
    parsedStatus = toNullableString(status, "status");
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request body" });
  }

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      name,
      description,
      rootPath,
      outputPath,
      primaryAgentId,
      gitRef: parsedGitRef,
      settings: parsedSettings,
      status: parsedStatus,
    },
  });
  res.json({ project: withSafeSettings(project) });
});

app.patch("/api/projects/:id", async (req, res) => {
  let gitRef: string | null | undefined;
  let settings: string | null | undefined;
  let status: string | null | undefined;

  try {
    gitRef = toNullableString(req.body.gitRef, "gitRef");
    settings = toSettingsJsonString(req.body.settings);
    status = toNullableString(req.body.status, "status");
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request body" });
  }

  const data: { gitRef?: string | null; settings?: string | null; status?: string | null } = {};
  if (gitRef !== undefined) data.gitRef = gitRef;
  if (settings !== undefined) data.settings = settings;
  if (status !== undefined) data.status = status;

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data,
  });

  return res.json({ project: withSafeSettings(project) });
});

app.post("/api/projects/:id/agents", async (req, res) => {
  const { agentIds, primaryAgentId } = req.body as { agentIds: string[]; primaryAgentId?: string | null };
  await prisma.projectAgent.deleteMany({ where: { projectId: req.params.id } });
  if (Array.isArray(agentIds) && agentIds.length) {
    await prisma.projectAgent.createMany({ data: agentIds.map((agentId) => ({ projectId: req.params.id, agentId })) });
  }
  const project = await prisma.project.update({ where: { id: req.params.id }, data: { primaryAgentId: primaryAgentId ?? null } });
  res.json({ project: withSafeSettings(project) });
});

app.get("/api/projects/:id/activity", async (req, res) => {
  const projectId = req.params.id;
  const [tasks, runs, artifacts] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" }, take: 15 }),
    prisma.taskRun.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.artifact.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  res.json({ tasks, runs, artifacts });
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
    data: { projectId, title, description, type, status, priority, assignedAgentId, expectedDeliverables },
  });
  res.status(201).json({ task });
});

app.get("/api/tasks/:id", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { artifacts: true, runs: true } });
  if (!task) return res.status(404).json({ error: "Task not found" });
  return res.json({ task });
});

app.put("/api/tasks/:id", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Task not found" });

  if (req.body.status && req.body.status !== existing.status) {
    const allowed = allowedTransitions[existing.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status transition ${existing.status} -> ${req.body.status}` });
    }
  }

  const task = await prisma.task.update({ where: { id: req.params.id }, data: req.body });
  return res.json({ task });
});

app.delete("/api/tasks/:id", async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

app.post("/api/tasks/:id/run", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const executeMode = (req.body.executeMode as "shell" | "openclaw") ?? "openclaw";
  let command = req.body.command as string | undefined;

  if (!command && executeMode === "openclaw") {
    const prompt = `Run task: ${task.title}\n\n${task.description ?? ""}\n\nExpected deliverables: ${task.expectedDeliverables ?? "n/a"}`;
    command = `openclaw agent --agent ${task.assignedAgentId ?? task.project.primaryAgentId ?? "cody"} --message ${JSON.stringify(prompt)} --json`;
  }

  if (!command) command = "echo No command provided";

  const cwd = (req.body.cwd as string | undefined) ?? task.project.rootPath;
  const runId = await taskExecutor.executeTask(task.id, command, cwd, {
    timeoutMs: Number(req.body.timeoutMs ?? 10 * 60_000),
    retries: Number(req.body.retries ?? 0),
  });
  return res.status(202).json({ runId, status: "RUNNING" });
});

app.post("/api/runs/:id/cancel", async (req, res) => {
  const ok = await taskExecutor.cancelRun(req.params.id);
  if (!ok) return res.status(404).json({ error: "Run not active" });
  return res.json({ status: "CANCELLED" });
});

app.get("/api/tasks/:id/runs", async (req, res) => {
  const runs = await prisma.taskRun.findMany({
    where: { taskId: req.params.id },
    orderBy: { createdAt: "desc" },
    include: { artifacts: true },
  });
  res.json({ runs });
});

app.get("/api/artifacts", async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const taskId = req.query.taskId as string | undefined;
  if (!projectId) return res.status(400).json({ error: "projectId is required" });

  const artifacts = await prisma.artifact.findMany({
    where: { projectId, ...(taskId ? { taskId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  res.json({
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      filename: path.basename(artifact.filePath),
      size: artifact.fileSize ? Number(artifact.fileSize) : null,
      createdAt: artifact.createdAt,
      mimeType: artifact.mimeType,
      path: artifact.filePath,
      taskId: artifact.taskId,
      projectId: artifact.projectId,
      runId: artifact.runId,
    })),
  });
});

app.get("/api/artifacts/:id/download", async (req, res) => {
  const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });

  const filePath = safePath(artifact.project.outputPath, artifact.filePath);
  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({ error: "Artifact file missing on disk" });
  }

  return res.download(filePath, path.basename(artifact.filePath));
});

app.delete("/api/artifacts/:id", async (req, res) => {
  const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!artifact) return res.status(404).json({ error: "Artifact not found" });

  const filePath = safePath(artifact.project.outputPath, artifact.filePath);
  await prisma.artifact.delete({ where: { id: req.params.id } });

  try {
    await fs.unlink(filePath);
  } catch {
    // file may already be gone; record deletion is still valid
  }

  return res.status(204).send();
});

app.get("/api/agents", async (_req, res) => {
  cachedAgents = await getAgents();
  for (const agent of cachedAgents) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: { name: agent.name, model: agent.model, capabilities: JSON.stringify(agent.capabilities), description: agent.description ?? null },
      create: { id: agent.id, name: agent.name, model: agent.model, capabilities: JSON.stringify(agent.capabilities), description: agent.description ?? null },
    });
  }
  res.json({ agents: cachedAgents });
});

app.post("/api/chat/thread", async (req, res) => {
  const { projectId, title } = req.body;
  const thread = await prisma.chatThread.create({ data: { projectId, title } });
  res.status(201).json({ thread });
});

app.get("/api/chat/project/:projectId/threads", async (req, res) => {
  const threads = await prisma.chatThread.findMany({ where: { projectId: req.params.projectId }, orderBy: { updatedAt: "desc" } });
  res.json({ threads });
});

app.get("/api/chat/:threadId/messages", async (req, res) => {
  const messages = await prisma.chatMessage.findMany({ where: { threadId: req.params.threadId }, orderBy: { createdAt: "asc" } });
  res.json({ messages });
});

const runOpenclawChat = async (options: { agentId: string; message: string; onToken: (chunk: string) => void }): Promise<string> => {
  const { agentId, message, onToken } = options;

  return await new Promise<string>((resolve, reject) => {
    const child = spawn("openclaw", ["agent", "--agent", agentId, "--message", message], {
      shell: false,
      env: process.env,
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      onToken(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += `\n[stderr] ${text}`;
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim() || "Done.");
      } else {
        reject(new Error(`openclaw exited with code ${code ?? -1}`));
      }
    });
  });
};

app.post("/api/chat/:threadId/messages", async (req, res) => {
  const { role = "User", content, agentId, attachments } = req.body as { role?: string; content: string; agentId?: string; attachments?: Array<{ name: string; contentBase64: string }> };

  const userMessage = await prisma.chatMessage.create({
    data: {
      threadId: req.params.threadId,
      role,
      content: `${content}${attachments?.length ? `\n\nAttachments: ${attachments.map((a) => a.name).join(", ")}` : ""}`,
      agentId: agentId ?? null,
    },
  });

  await prisma.chatThread.update({ where: { id: req.params.threadId }, data: { updatedAt: new Date() } });

  const thread = await prisma.chatThread.findUnique({ where: { id: req.params.threadId }, include: { project: true } });
  if (!thread) return res.status(404).json({ error: "Thread not found" });

  const attachmentNotes: string[] = [];
  if (attachments?.length) {
    const attachmentDir = path.join(thread.project.outputPath, "chat-attachments", req.params.threadId);
    await fs.mkdir(attachmentDir, { recursive: true });

    for (const attachment of attachments) {
      const safeName = path.basename(attachment.name || `file-${Date.now()}`);
      const target = safePath(attachmentDir, safeName);
      const contentBuffer = Buffer.from(attachment.contentBase64, "base64");
      await fs.writeFile(target, contentBuffer);
      attachmentNotes.push(`- ${safeName} (${contentBuffer.length} bytes)`);
    }
  }

  const prompt = [
    `Project: ${thread.project.name}`,
    `Root path: ${thread.project.rootPath}`,
    `Output path: ${thread.project.outputPath}`,
    "",
    "User message:",
    content,
    attachmentNotes.length ? `\nAttachments:\n${attachmentNotes.join("\\n")}` : "",
  ].join("\n");

  const selectedAgent = agentId ?? thread.project.primaryAgentId ?? "cody";
  let replyContent = "";

  try {
    replyContent = await runOpenclawChat({
      agentId: selectedAgent,
      message: prompt,
      onToken: (chunk) => websocketService.broadcast({ type: "chat.token", payload: { threadId: req.params.threadId, chunk } }),
    });
  } catch (error) {
    replyContent = `Chat execution failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }

  const agentMessage = await prisma.chatMessage.create({ data: { threadId: req.params.threadId, role: "Agent", agentId: selectedAgent, content: replyContent } });
  websocketService.broadcast({ type: "chat.done", payload: { threadId: req.params.threadId, messageId: agentMessage.id } });

  res.status(201).json({ message: userMessage, reply: agentMessage });
});

app.post("/api/chat/:threadId/save-to-task/:taskId", async (req, res) => {
  const messages = await prisma.chatMessage.findMany({ where: { threadId: req.params.threadId }, orderBy: { createdAt: "asc" } });
  const transcript = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
  const task = await prisma.task.update({
    where: { id: req.params.taskId },
    data: { description: `${(await prisma.task.findUnique({ where: { id: req.params.taskId } }))?.description ?? ""}\n\n---\nChat transcript:\n${transcript}`.trim() },
  });
  res.json({ task });
});

app.post("/api/chat/:threadId/create-task", async (req, res) => {
  const thread = await prisma.chatThread.findUnique({ where: { id: req.params.threadId } });
  if (!thread) return res.status(404).json({ error: "Thread not found" });

  const { title, type = "PLAN", priority = 1 } = req.body;
  const task = await prisma.task.create({ data: { projectId: thread.projectId, title: title ?? "Task from chat", type, priority, status: "BACKLOG" } });
  res.status(201).json({ task });
});

app.get("/api/chat/:threadId/export", async (req, res) => {
  const messages = await prisma.chatMessage.findMany({ where: { threadId: req.params.threadId }, orderBy: { createdAt: "asc" } });
  const markdown = messages.map((m) => `## ${m.role} (${m.createdAt.toISOString()})\n\n${m.content}`).join("\n\n");
  res.json({ markdown });
});

const safePath = (base: string, maybeRelative: string): string => {
  const resolved = path.resolve(base, maybeRelative || ".");
  if (!resolved.startsWith(path.resolve(base))) throw new Error("Invalid path");
  return resolved;
};

app.get("/api/projects/:id/files", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const queryPath = String(req.query.path ?? ".");
  const search = String(req.query.search ?? "").toLowerCase();
  const target = safePath(project.outputPath, queryPath);

  const tree = async (dir: string): Promise<Array<Record<string, unknown>>> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes = await Promise.all(entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      const rel = path.relative(project.outputPath, full);
      if (search && !rel.toLowerCase().includes(search)) return null;
      if (entry.isDirectory()) {
        return { type: "dir", name: entry.name, path: rel, children: await tree(full) };
      }
      const stat = await fs.stat(full);
      return { type: "file", name: entry.name, path: rel, size: stat.size };
    }));
    return nodes.filter(Boolean) as Array<Record<string, unknown>>;
  };

  const files = await tree(target);
  res.json({ root: project.outputPath, files });
});

app.get("/api/projects/:id/files/preview", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rel = String(req.query.path ?? "");
  const full = safePath(project.outputPath, rel);
  const stat = await fs.stat(full);
  if (stat.size > 1024 * 1024) return res.status(400).json({ error: "File exceeds 1MB preview limit" });
  const buffer = await fs.readFile(full);
  const isBinary = buffer.includes(0);
  if (isBinary) {
    return res.status(400).json({ error: "Binary file preview not supported" });
  }
  const content = buffer.toString("utf-8");
  res.json({ path: rel, content });
});

app.post("/api/projects/:id/open-folder", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const target = project.outputPath;
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  await execFileAsync(opener, [target]);
  res.json({ status: "ok" });
});

app.post("/api/scheduler", async (req, res) => {
  const { projectId, name, description, jobType, cronExpression, timezone, enabled, targetTaskId } = req.body;
  if (!isValidCron(cronExpression)) return res.status(400).json({ error: "Invalid cron expression" });

  const job = await prisma.cronJob.create({
    data: { projectId, name, description, jobType, cronExpression, timezone, enabled, targetTaskId },
  });

  if (job.enabled) scheduler.scheduleJob(job.id, job.cronExpression, job.timezone);
  return res.status(201).json({ job });
});

app.get("/api/scheduler", async (_req, res) => {
  const jobs = await prisma.cronJob.findMany({ orderBy: { createdAt: "desc" }, include: { runs: true } });
  res.json({ jobs });
});

app.post("/api/scheduler/:id/run-now", async (req, res) => {
  const job = await prisma.cronJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Scheduler job not found" });
  void scheduler.executeJob(job.id);
  return res.status(202).json({ status: "RUNNING" });
});

app.put("/api/scheduler/:id/enable", async (req, res) => {
  const job = await prisma.cronJob.update({ where: { id: req.params.id }, data: { enabled: true } });
  scheduler.scheduleJob(job.id, job.cronExpression, job.timezone);
  res.json({ job });
});

app.put("/api/scheduler/:id/disable", async (req, res) => {
  const job = await prisma.cronJob.update({ where: { id: req.params.id }, data: { enabled: false } });
  scheduler.stopJob(job.id);
  res.json({ job });
});

app.get("/api/scheduler/:id/runs", async (req, res) => {
  const runs = await prisma.schedulerJobRun.findMany({ where: { jobId: req.params.id }, orderBy: { createdAt: "desc" } });
  res.json({ runs });
});

app.patch("/api/scheduler/:id", async (req, res) => {
  const { name, description, cronExpression, timezone, enabled, targetTaskId, jobType } = req.body as Record<string, unknown>;

  if (cronExpression !== undefined && (typeof cronExpression !== "string" || !isValidCron(cronExpression))) {
    return res.status(400).json({ error: "Invalid cron expression" });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (cronExpression !== undefined) updateData.cronExpression = cronExpression;
  if (timezone !== undefined) updateData.timezone = timezone;
  if (enabled !== undefined) updateData.enabled = Boolean(enabled);
  if (targetTaskId !== undefined) updateData.targetTaskId = targetTaskId || null;
  if (jobType !== undefined) updateData.jobType = jobType;

  const job = await prisma.cronJob.update({ where: { id: req.params.id }, data: updateData });

  if (job.enabled) {
    scheduler.scheduleJob(job.id, job.cronExpression, job.timezone);
  } else {
    scheduler.stopJob(job.id);
  }

  return res.json({ job });
});

app.delete("/api/scheduler/:id", async (req, res) => {
  scheduler.stopJob(req.params.id);
  await prisma.cronJob.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

app.get("/api/settings", (_req, res) => {
  res.json({
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "development",
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db",
      OPENCLAW_CONFIG: path.join(os.homedir(), ".openclaw", "openclaw.json"),
      API_BASE: "http://127.0.0.1:4000",
    },
  });
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
