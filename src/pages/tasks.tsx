import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Project = { id: string; name: string; description?: string | null };

export default function TasksLandingPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    void fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <p className="text-sm text-slate-400">Select a project to open its Kanban board.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="border-slate-800 bg-slate-900/60">
            <CardHeader><CardTitle>{project.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-400">{project.description ?? "No description"}</p>
              <Link className="text-sm underline" href={`/projects/${project.id}/tasks`}>Open board</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
