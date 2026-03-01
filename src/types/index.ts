import type { CronJob, Project, SchedulerJobRun, Task, TaskRun } from "../generated/prisma/client";

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export interface ProjectResponse {
  project: Project;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface TaskResponse {
  task: Task;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface AgentDescriptor {
  id: string;
  name: string;
  model: string;
  capabilities: string[];
  description?: string;
}

export interface AgentsResponse {
  agents: AgentDescriptor[];
}

export interface TaskRunResponse {
  run: TaskRun;
}

export interface TaskRunsResponse {
  runs: TaskRun[];
}

export interface RunTaskResponse {
  runId: string;
  status: string;
}

export interface SchedulerJobResponse {
  job: CronJob;
}

export interface SchedulerJobsResponse {
  jobs: CronJob[];
}

export interface SchedulerJobRunsResponse {
  runs: SchedulerJobRun[];
}
