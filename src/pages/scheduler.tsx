import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Job = {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  nextRunAt?: string | null;
  runs?: Array<{ id: string; status: string; createdAt: string }>;
};

type Project = { id: string; name: string };

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ projectId: "", name: "", cronExpression: "*/15 * * * *", timezone: "UTC", targetTaskId: "" });

  const load = () => void fetch("/api/scheduler").then((r) => r.json()).then((d) => setJobs(d.jobs ?? []));

  useEffect(() => {
    load();
    void fetch("/api/projects").then((r) => r.json()).then((d) => {
      const incoming = d.projects ?? [];
      setProjects(incoming);
      if (incoming[0] && !form.projectId) {
        setForm((prev) => ({ ...prev, projectId: incoming[0].id }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createJob = async (event: FormEvent) => {
    event.preventDefault();
    await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        jobType: "RUN_TASK",
        description: null,
        enabled: true,
        targetTaskId: form.targetTaskId || null,
      }),
    });
    setShowCreate(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Scheduler</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "Create Job"}</Button>
      </div>

      {showCreate && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>New Cron Job</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={createJob}>
              <select className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={form.projectId} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))} required>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <Input placeholder="Job Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              <Input placeholder="Cron expression" value={form.cronExpression} onChange={(e) => setForm((p) => ({ ...p, cronExpression: e.target.value }))} required />
              <Input placeholder="Timezone" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Target Task ID (optional)" value={form.targetTaskId} onChange={(e) => setForm((p) => ({ ...p, targetTaskId: e.target.value }))} />
              <div className="md:col-span-2"><Button type="submit">Create Job</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {jobs.map((job) => (
        <Card key={job.id} className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>{job.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-slate-300">Cron: {job.cronExpression}</div>
            <div className="text-slate-400">Next run: {job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "n/a"}</div>
            <div className="flex items-center gap-3">
              <Switch
                checked={job.enabled}
                onCheckedChange={(checked) => {
                  void fetch(`/api/scheduler/${job.id}/${checked ? "enable" : "disable"}`, { method: "PUT" }).then(load);
                }}
              />
              <Button variant="outline" onClick={() => void fetch(`/api/scheduler/${job.id}/run-now`, { method: "POST" }).then(load)}>Run now</Button>
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <div>Run history</div>
              {(job.runs ?? []).slice(0, 5).map((run) => (
                <div key={run.id} className="rounded border border-slate-800 p-2">{run.id.slice(0, 8)} · {run.status}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
