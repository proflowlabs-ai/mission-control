import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMissionControlStore } from "@/store/useMissionControlStore";

const columns = ["BACKLOG", "PLANNED", "IN_PROGRESS", "BLOCKED", "DONE"];

export default function TasksPage() {
  const { query } = useRouter();
  const projectId = query.id as string;
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null);
  const logs = useMissionControlStore((s) => s.logs);
  const appendLog = useMissionControlStore((s) => s.appendLog);

  useEffect(() => {
    if (!projectId) return;
    void fetch(`http://127.0.0.1:4000/api/tasks?projectId=${projectId}`).then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    const ws = new WebSocket("ws://127.0.0.1:4000/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; payload: { runId?: string; data?: string } };
      if ((data.type === "task.stdout" || data.type === "task.stderr") && data.payload.runId) {
        appendLog(data.payload.runId, data.payload.data ?? "");
      }
    };
    return () => ws.close();
  }, [projectId, appendLog]);

  const grouped = useMemo(() => {
    return columns.reduce<Record<string, typeof tasks>>((acc, col) => {
      acc[col] = tasks.filter((task) => task.status === col);
      return acc;
    }, {} as Record<string, typeof tasks>);
  }, [tasks]);

  const runTask = async (taskId: string) => {
    const run = await fetch(`http://127.0.0.1:4000/api/tasks/${taskId}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "echo hello-from-task" }) }).then((r) => r.json());
    appendLog(run.runId, "Task started");
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Kanban (drag-and-drop ready)</h1>
      <div className="grid md:grid-cols-5 gap-3">
        {columns.map((column) => (
          <Card key={column}>
            <CardHeader><CardTitle>{column}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {grouped[column]?.map((task) => (
                <Dialog key={task.id}>
                  <DialogTrigger asChild>
                    <button className="w-full rounded border p-2 text-left" onClick={() => setSelected({ id: task.id, title: task.title })}>{task.title}</button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{selected?.title}</DialogTitle></DialogHeader>
                    <Button onClick={() => runTask(task.id)}>Run</Button>
                    <pre className="mt-3 max-h-64 overflow-auto text-xs">{Object.values(logs).flat().join("\n") || "Live logs will appear here"}</pre>
                  </DialogContent>
                </Dialog>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
