import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Project = { id: string; name: string; description?: string | null; rootPath: string; outputPath: string; primaryAgentId?: string | null };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", rootPath: "", outputPath: "", primaryAgentId: "" });

  const load = () => void fetch("/api/projects").then((r) => r.json()).then((data) => setProjects(data.projects ?? []));
  useEffect(load, []);

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, primaryAgentId: form.primaryAgentId || null }),
    });
    setForm({ name: "", description: "", rootPath: "", outputPath: "", primaryAgentId: "" });
    setShowCreate(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "Create Project"}</Button>
      </div>

      {showCreate && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader><CardTitle>New Project</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={createProject}>
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              <Input placeholder="Primary Agent ID (optional)" value={form.primaryAgentId} onChange={(e) => setForm((p) => ({ ...p, primaryAgentId: e.target.value }))} />
              <Input placeholder="Root Path" value={form.rootPath} onChange={(e) => setForm((p) => ({ ...p, rootPath: e.target.value }))} required />
              <Input placeholder="Output Path" value={form.outputPath} onChange={(e) => setForm((p) => ({ ...p, outputPath: e.target.value }))} required />
              <Input className="md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              <div className="md:col-span-2"><Button type="submit">Create</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="border-slate-800 bg-slate-900/60">
            <CardHeader><CardTitle>{project.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate-300">{project.description ?? "No description"}</p>
              <p className="text-slate-400">root: {project.rootPath}</p>
              <p className="text-slate-400">status: <span className="text-emerald-300">active</span></p>
              <Link className="underline" href={`/projects/${project.id}`}>Open project detail</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
