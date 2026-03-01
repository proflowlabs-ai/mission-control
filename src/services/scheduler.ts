import cron, { type ScheduledTask } from "node-cron";
import type { PrismaClient } from "../generated/prisma/client";
import { TaskExecutor } from "./taskExecutor";
import { websocketService } from "./websocket";

export const isValidCron = (expression: string): boolean => cron.validate(expression);

export class SchedulerService {
  private jobs = new Map<string, ScheduledTask>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly taskExecutor: TaskExecutor,
  ) {}

  async start(): Promise<void> {
    const enabledJobs = await this.prisma.cronJob.findMany({ where: { enabled: true } });
    for (const job of enabledJobs) {
      this.scheduleJob(job.id, job.cronExpression, job.timezone);
    }
  }

  stopJob(jobId: string): void {
    const existing = this.jobs.get(jobId);
    if (existing) {
      existing.stop();
      existing.destroy();
      this.jobs.delete(jobId);
    }
  }

  scheduleJob(jobId: string, expression: string, timezone = "UTC"): void {
    this.stopJob(jobId);

    const task = cron.schedule(
      expression,
      async () => {
        await this.executeJob(jobId);
      },
      { timezone },
    );

    this.jobs.set(jobId, task);
  }

  async executeJob(jobId: string): Promise<void> {
    const job = await this.prisma.cronJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const run = await this.prisma.schedulerJobRun.create({
      data: { jobId, status: "RUNNING" },
    });

    try {
      if (job.targetTaskId) {
        const task = await this.prisma.task.findUnique({
          where: { id: job.targetTaskId },
          include: { project: true },
        });

        if (task) {
          await this.taskExecutor.executeTask(task.id, "echo scheduler-run", task.project.rootPath);
        }
      }

      await this.prisma.schedulerJobRun.update({
        where: { id: run.id },
        data: { status: "COMPLETED", endTime: new Date(), exitCode: 0 },
      });

      await this.prisma.cronJob.update({
        where: { id: jobId },
        data: { lastRunAt: new Date() },
      });

      websocketService.broadcast({
        type: "scheduler.update",
        payload: { jobId, runId: run.id, status: "COMPLETED" },
      });
    } catch (error) {
      await this.prisma.schedulerJobRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          endTime: new Date(),
          exitCode: -1,
          logs: error instanceof Error ? error.message : "Unknown scheduler error",
        },
      });

      websocketService.broadcast({
        type: "scheduler.update",
        payload: { jobId, runId: run.id, status: "FAILED" },
      });
    }
  }
}
