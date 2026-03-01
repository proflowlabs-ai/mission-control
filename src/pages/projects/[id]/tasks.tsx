import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMissionControlStore } from "@/store/useMissionControlStore";

const columns = ["BACKLOG", "PLANNED", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

type Task = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: (typeof columns)[number];
  priority: number;
  assignedAgentId?: string | null;
};

type Agent = { id: string; name: string };

export default function TasksPage() {
  const { query } = useRouter();
  const projectId = query.id as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const logs = useMissionControlStore((s) => s.logs);
  const appendLog = useMissionControlStore((s) => s.appendLog);

  useEffect(() => {
    if (!projectId) return;
    void fetch(`/api/tasks?projectId=${projectId}`).then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    void fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.hostname}:4000/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; payload: { runId?: string; data?: string } };
      if ((data.type === "task.stdout" || data.type === "task.stderr") && data.payload.runId) {
        appendLog(data.payload.runId, data.payload.data ?? "");
      }
    };
    return () => ws.close();
  }, [projectId, appendLog]);

  const grouped = useMemo(() => {
    return columns.reduce<Record<string, Task[]>>((acc, col) => {
      acc[col] = tasks.filter((task) => task.status === col);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [tasks]);

  const runTask = async (task: Task) => {
    const payload = {
      command: `echo Running task ${task.title.replace(/"/g, "")} && sleep 1 && echo Done`,
    };
    const run = await fetch(`/api/tasks/${task.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    setSelectedRunId(run.runId as string);
    appendLog(run.runId as string, `Task ${task.title} started`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kanban Board</h1>
      <div className="grid gap-3 xl:grid-cols-5">
        {columns.map((column) => (
          <Card key={column} className="border-slate-800 bg-slate-900/60">
            <CardHeader><CardTitle className="text-sm">{column.replace("_", " ")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {grouped[column]?.map((task) => (
                <Dialog key={task.id}>
                  <DialogTrigger asChild>
                    <button className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-left text-sm hover:border-slate-500">
                      <div className="font-medium">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-400 line-clamp-2">{task.description ?? "No description"}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="outline">{task.type}</Badge>
                        <Badge variant="outline">P{task.priority}</Badge>
                        <Badge variant="outline">{agents.find((a) => a.id === task.assignedAgentId)?.name ?? "Unassigned"}</Badge>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-slate-100">
                    <DialogHeader><DialogTitle>{task.title}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <p className="text-sm text-slate-300">{task.description ?? "No description"}</p>
                      <Button onClick={() => runTask(task)}>Run Task</Button>
                      <pre className="max-h-72 overflow-auto rounded border border-slate-800 bg-black/40 p-3 text-xs">
                        {(selectedRunId ? logs[selectedRunId] : undefined)?.join("\n") || "Live logs will appear here after starting a run."}
                      </pre>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
