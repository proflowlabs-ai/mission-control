import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; description?: string }>>([]);

  useEffect(() => {
    void fetch("http://127.0.0.1:4000/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []));
  }, []);

  return (
    <main className="p-6 space-y-4">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button>New Project</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader><CardTitle>{project.name}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{project.description}</p>
              <Link className="text-sm underline" href={`/projects/${project.id}`}>Open Project</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
