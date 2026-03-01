import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectDetailPage() {
  const { query } = useRouter();
  const id = query.id as string;
  const [project, setProject] = useState<{ name: string } | null>(null);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!id) return;
    void fetch(`http://127.0.0.1:4000/api/projects/${id}`).then((r) => r.json()).then((d) => setProject(d.project));
    void fetch(`http://127.0.0.1:4000/api/tasks?projectId=${id}`).then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    void fetch("http://127.0.0.1:4000/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));
  }, [id]);

  return (
    <main className="p-6 grid gap-4">
      <h1 className="text-2xl font-bold">{project?.name ?? "Project"}</h1>
      <div className="flex gap-3 text-sm underline">
        <Link href={`/projects/${id}/tasks`}>Tasks Board</Link>
        <Link href={`/projects/${id}/chat`}>Chat</Link>
        <Link href={`/projects/${id}/files`}>Files</Link>
      </div>
      <Card><CardHeader><CardTitle>Task List</CardTitle></CardHeader><CardContent>{tasks.map((t) => <div key={t.id}>{t.title} · {t.status}</div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Assigned Agents</CardTitle></CardHeader><CardContent>{agents.map((a) => <div key={a.id}>{a.name}</div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader><CardContent>Use task detail modal in board for run logs.</CardContent></Card>
    </main>
  );
}
