import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Task = { id: string; title: string; status: string; projectId: string };
type Job = { id: string; name: string; nextRunAt?: string | null; runs?: Array<{ id: string; status: string }> };

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [health, setHealth] = useState("unknown");
  const [runningRuns, setRunningRuns] = useState<Array<{ id: string; taskId: string; status: string }>>([]);

  useEffect(() => {
    void fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    void fetch("/api/scheduler").then((r) => r.json()).then((d) => setJobs(d.jobs ?? []));
    void fetch("/health").then((r) => r.json()).then((d) => setHealth(d.status ?? "down"));
  }, []);

  useEffect(() => {
    if (!tasks.length) {
      setRunningRuns([]);
      return;
    }
    void Promise.all(tasks.slice(0, 20).map((task) => fetch(`/api/tasks/${task.id}/runs`).then((r) => r.json())))
      .then((result) => result.flatMap((entry) => (entry.runs ?? []) as Array<{ id: string; taskId: string; status: string }>))
      .then((allRuns) => setRunningRuns(allRuns.filter((run) => run.status === "RUNNING")));
  }, [tasks]);

  const activeTasks = useMemo(() => tasks.filter((t) => t.status === "IN_PROGRESS"), [tasks]);
  const blockedTasks = useMemo(() => tasks.filter((t) => t.status === "BLOCKED"), [tasks]);
  const recentCompletions = useMemo(() => tasks.filter((t) => t.status === "DONE").slice(0, 5), [tasks]);
  const upcoming = useMemo(() => jobs.filter((j) => j.nextRunAt).sort((a, b) => new Date(a.nextRunAt ?? 0).getTime() - new Date(b.nextRunAt ?? 0).getTime()).slice(0, 5), [jobs]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active tasks" value={activeTasks.length} />
        <StatCard label="Running executions" value={runningRuns.length} />
        <StatCard label="Upcoming jobs" value={upcoming.length} />
        <StatCard label="Recent completions" value={recentCompletions.length} />
        <StatCard label="Blocked tasks" value={blockedTasks.length} tone={blockedTasks.length ? "warn" : "ok"} />
        <StatCard label="System health" value={health.toUpperCase()} tone={health === "ok" ? "ok" : "warn"} />
      </div>

      {!!blockedTasks.length && (
        <Alert className="border-amber-700/40 bg-amber-950/40 text-amber-200">
          <AlertTitle>Blocked tasks need attention</AlertTitle>
          <AlertDescription>{blockedTasks.map((t) => t.title).join(" · ")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Active tasks across projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activeTasks.length ? activeTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded border border-slate-800 p-2">
                <span>{task.title}</span>
                <Link href={`/projects/${task.projectId}/tasks`} className="text-xs text-slate-300 underline">Open board</Link>
              </div>
            )) : <p className="text-sm text-slate-400">No active tasks.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Upcoming scheduled jobs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length ? upcoming.map((job) => (
              <div key={job.id} className="rounded border border-slate-800 p-2 text-sm">
                <div className="font-medium">{job.name}</div>
                <div className="text-slate-400">{new Date(job.nextRunAt!).toLocaleString()}</div>
              </div>
            )) : <p className="text-sm text-slate-400">No upcoming jobs.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Running executions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {runningRuns.length ? runningRuns.slice(0, 8).map((run) => (
              <div key={run.id} className="rounded border border-slate-800 p-2 text-sm">
                <div className="font-medium">Run {run.id.slice(0, 8)}</div>
                <Badge variant="outline" className="mt-1 border-blue-700/50 bg-blue-950 text-blue-300">{run.status}</Badge>
              </div>
            )) : <p className="text-sm text-slate-400">No running executions.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Recent completions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentCompletions.length ? recentCompletions.map((task) => (
              <div key={task.id} className="rounded border border-slate-800 p-2 text-sm">{task.title}</div>
            )) : <p className="text-sm text-slate-400">No completed tasks.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "ok" | "warn" }) {
  const toneClass = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-slate-100";
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">{label}</CardTitle></CardHeader>
      <CardContent><div className={`text-2xl font-semibold ${toneClass}`}>{value}</div></CardContent>
    </Card>
  );
}
