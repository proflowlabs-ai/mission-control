import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const [stats, setStats] = useState({ activeTasks: 0, runs: 0, jobs: 0 });
  const [health, setHealth] = useState("unknown");

  useEffect(() => {
    void Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/scheduler").then((r) => r.json()),
      fetch("/health").then((r) => r.json()),
    ]).then(([tasks, jobs, healthRes]) => {
      const activeTasks = (tasks.tasks ?? []).filter((t: { status: string }) => t.status === "IN_PROGRESS").length;
      const runs = (jobs.jobs ?? []).reduce((sum: number, j: { runs?: unknown[] }) => sum + (j.runs?.length ?? 0), 0);
      setStats({ activeTasks, runs, jobs: jobs.jobs?.length ?? 0 });
      setHealth(healthRes.status ?? "down");
    });
  }, []);

  return (
    <main className="p-6 grid gap-4 md:grid-cols-4">
      <Card><CardHeader><CardTitle>Active Tasks</CardTitle></CardHeader><CardContent>{stats.activeTasks}</CardContent></Card>
      <Card><CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader><CardContent>{stats.runs}</CardContent></Card>
      <Card><CardHeader><CardTitle>Upcoming Jobs</CardTitle></CardHeader><CardContent>{stats.jobs}</CardContent></Card>
      <Card><CardHeader><CardTitle>Health</CardTitle></CardHeader><CardContent>{health}</CardContent></Card>
    </main>
  );
}
