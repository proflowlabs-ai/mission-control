import { spawn } from "node:child_process";

import type { PrismaClient } from "../generated/prisma/client";
import { websocketService } from "./websocket";

const splitCommand = (command: string): string[] => {
  const matches = command.match(/(?:[^\s\"]+|\"[^\"]*\")+/g) ?? [];
  return matches.map((part) => part.replace(/^\"|\"$/g, ""));
};

export class TaskExecutor {
  constructor(private readonly prisma: PrismaClient) {}

  async executeTask(taskId: string, command: string | string[], cwd: string): Promise<string> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error("Task not found");
    }

    const run = await this.prisma.taskRun.create({
      data: {
        taskId,
        projectId: task.projectId,
        status: "RUNNING",
      },
    });

    const parts = Array.isArray(command) ? command : splitCommand(command);
    if (parts.length === 0) {
      throw new Error("Command cannot be empty");
    }

    const [bin, ...args] = parts;
    const child = spawn(bin, args, {
      cwd,
      shell: false,
      env: process.env,
    });

    let logs = "";

    child.stdout.on("data", async (chunk) => {
      const text = chunk.toString();
      logs += text;
      websocketService.broadcast({
        type: "task.stdout",
        payload: { taskId, runId: run.id, data: text },
      });
      await this.prisma.taskRun.update({ where: { id: run.id }, data: { logs } });
    });

    child.stderr.on("data", async (chunk) => {
      const text = chunk.toString();
      logs += text;
      websocketService.broadcast({
        type: "task.stderr",
        payload: { taskId, runId: run.id, data: text },
      });
      await this.prisma.taskRun.update({ where: { id: run.id }, data: { logs } });
    });

    child.on("close", async (code) => {
      const status = code === 0 ? "COMPLETED" : "FAILED";
      await this.prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status,
          exitCode: code ?? -1,
          endTime: new Date(),
          logs,
        },
      });

      websocketService.broadcast({
        type: "task.exit",
        payload: { taskId, runId: run.id, exitCode: code ?? -1, status },
      });
    });

    child.on("error", async (error) => {
      logs += `\n${error.message}`;
      await this.prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          exitCode: -1,
          endTime: new Date(),
          logs,
        },
      });

      websocketService.broadcast({
        type: "task.stderr",
        payload: { taskId, runId: run.id, data: error.message },
      });
    });

    return run.id;
  }
}
