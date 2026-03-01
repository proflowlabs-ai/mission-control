import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Project = { id: string; name: string; description?: string | null; outputPath: string };
type Task = { id: string; title: string; status: string };
type Agent = { id: string; name: string };

type TaskRun = { id: string; status: string; taskId: string };

export default function ProjectDetailPage() {
  const { query } = useRouter();
  const id = query.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; name: string }>>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/projects/${id}`).then((r) => r.json()).then((d) => setProject(d.project));
    void fetch(`/api/tasks?projectId=${id}`).then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    void fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));
    void fetch("/api/scheduler").then((r) => r.json()).then((d) => setJobs((d.jobs ?? []).filter((job: { projectId: string }) => job.projectId === id)));
  }, [id]);

  useEffect(() => {
    if (!tasks.length) return;
    void Promise.all(tasks.map((task) => fetch(`/api/tasks/${task.id}/runs`).then((r) => r.json())))
      .then((result) => result.flatMap((entry) => (entry.runs ?? []) as TaskRun[]))
      .then(setRuns);
  }, [tasks]);

  const doneTasks = useMemo(() => tasks.filter((task) => task.status === "DONE").length, [tasks]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{project?.name ?? "Project"}</h1>
        <p className="text-sm text-slate-400">{project?.description ?? "No description"}</p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href={`/projects/${id}/tasks`}>Tasks Board</Link>
        <Link className="underline" href={`/projects/${id}/chat`}>Chat</Link>
        <Link className="underline" href={`/projects/${id}/files`}>Files</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCard title="Tasks" value={tasks.length} />
        <MiniCard title="Completed" value={doneTasks} />
        <MiniCard title="Runs" value={runs.length} />
        <MiniCard title="Scheduled Jobs" value={jobs.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tasks.map((task) => <div key={task.id} className="rounded border border-slate-800 p-2">{task.title} · {task.status}</div>)}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Agents</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {agents.map((agent) => <div key={agent.id} className="rounded border border-slate-800 p-2">{agent.name}</div>)}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {runs.slice(0, 8).map((run) => <div key={run.id} className="rounded border border-slate-800 p-2">{run.id.slice(0, 8)} · {run.status}</div>)}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>Artifacts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>Output path: {project?.outputPath ?? "n/a"}</p>
            <Link className="underline" href={`/projects/${id}/files`}>Browse output files</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">{title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
