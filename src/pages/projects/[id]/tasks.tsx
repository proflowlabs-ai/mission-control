import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMissionControlStore } from "@/store/useMissionControlStore";
import { ArtifactPanel } from "@/components/artifact-panel";

const columns = ["BACKLOG", "PLANNED", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

type Task = {
  id: string;
  title: string;
  description?: string | null;
  type: "PLAN" | "BUILD" | "OPS";
  status: (typeof columns)[number];
  priority: number;
  assignedAgentId?: string | null;
  expectedDeliverables?: string | null;
};

type Agent = { id: string; name: string };

export default function TasksPage() {
  const { query } = useRouter();
  const projectId = query.id as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const logs = useMissionControlStore((s) => s.logs);
  const appendLog = useMissionControlStore((s) => s.appendLog);

  const load = () => {
    if (!projectId) return;
    void fetch(`/api/tasks?projectId=${projectId}`).then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    void fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));
  };

  useEffect(() => {
    load();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const grouped = useMemo(() => columns.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col] = tasks.filter((task) => task.status === col);
    return acc;
  }, {} as Record<string, Task[]>), [tasks]);

  const runTask = async (task: Task) => {
    const run = await fetch(`/api/tasks/${task.id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ executeMode: "openclaw" }) }).then((r) => r.json());
    setSelectedRunId(run.runId as string);
    appendLog(run.runId as string, `Task ${task.title} started`);
  };

  const moveTask = async (taskId: string, status: Task["status"]) => {
    await fetch(`/api/tasks/${taskId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  const priorityLabel = (p: number) => (p >= 2 ? "HIGH" : p === 1 ? "MED" : "LOW");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Kanban Board</h1>
        <Button onClick={() => setCreating((v) => !v)}>{creating ? "Cancel" : "Create Task"}</Button>
      </div>
      {creating && projectId && <TaskCreateForm projectId={projectId} agents={agents} onSaved={() => { setCreating(false); load(); }} />}
      <div className="grid gap-3 xl:grid-cols-5">
        {columns.map((column) => (
          <Card
            key={column}
            className="border-slate-800 bg-slate-900/60"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData("taskId");
              if (taskId) void moveTask(taskId, column);
            }}
          >
            <CardHeader><CardTitle className="text-sm">{column.replace("_", " ")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {grouped[column]?.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-left text-sm hover:border-slate-500"
                >
                  <div className="font-medium">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-400 line-clamp-2">{task.description ?? "No description"}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline">{task.type}</Badge>
                    <Badge variant="outline">{priorityLabel(task.priority)}</Badge>
                    <Badge variant="outline">{agents.find((a) => a.id === task.assignedAgentId)?.name ?? "Unassigned"}</Badge>
                  </div>
                  {task.expectedDeliverables && <div className="mt-2 text-xs text-slate-300">Deliverables: {task.expectedDeliverables}</div>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetail(task)}>Details</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(task)}>Edit</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{detail?.description ?? "No description"}</p>
            <div>Type: {detail?.type}</div>
            <div>Priority: {detail ? priorityLabel(detail.priority) : "-"}</div>
            <div>Status: {detail?.status}</div>
            <div>Expected Deliverables: {detail?.expectedDeliverables ?? "-"}</div>
            {detail && <Button onClick={() => runTask(detail)}>Run Task</Button>}
            <pre className="max-h-72 overflow-auto rounded border border-slate-800 bg-black/40 p-3 text-xs">{(selectedRunId ? logs[selectedRunId] : undefined)?.join("\n") || "Live logs will appear here after starting a run."}</pre>
            {detail && projectId && (
              <div className="rounded border border-slate-800 bg-slate-900/30 p-3">
                <ArtifactPanel projectId={projectId} taskId={detail.id} refreshKey={selectedRunId ? logs[selectedRunId]?.length ?? 0 : 0} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          {editing && (
            <TaskEditForm task={editing} agents={agents} onSaved={() => { setEditing(null); load(); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCreateForm({ projectId, agents, onSaved }: { projectId: string; agents: Agent[]; onSaved: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", type: "BUILD" as Task["type"], priority: 1, assignedAgentId: "", expectedDeliverables: "" });

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardContent className="pt-4">
        <form className="grid gap-2 md:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, projectId, status: "BACKLOG", assignedAgentId: form.assignedAgentId || null }),
          });
          onSaved();
        }}>
          <Input className="md:col-span-2" value={form.title} placeholder="Task title" onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          <Input className="md:col-span-2" value={form.description} placeholder="Description" onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <Input className="md:col-span-2" value={form.expectedDeliverables} placeholder="Expected deliverables" onChange={(e) => setForm((p) => ({ ...p, expectedDeliverables: e.target.value }))} />
          <select className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Task["type"] }))}><option value="PLAN">PLAN</option><option value="BUILD">BUILD</option><option value="OPS">OPS</option></select>
          <select className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={String(form.priority)} onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))}><option value="0">LOW</option><option value="1">MEDIUM</option><option value="2">HIGH</option></select>
          <select className="h-10 md:col-span-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={form.assignedAgentId} onChange={(e) => setForm((p) => ({ ...p, assignedAgentId: e.target.value }))}>
            <option value="">Unassigned</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <div className="md:col-span-2"><Button type="submit">Create Task</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function TaskEditForm({ task, agents, onSaved }: { task: Task; agents: Agent[]; onSaved: () => void }) {
  const [form, setForm] = useState(task);

  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      await fetch(`/api/tasks/${task.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSaved();
    }}>
      <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
      <Input value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />
      <Input value={form.expectedDeliverables ?? ""} onChange={(e) => setForm((p) => ({ ...p, expectedDeliverables: e.target.value }))} placeholder="Expected deliverables" />
      <select className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Task["type"] }))}>
        <option value="PLAN">PLAN</option><option value="BUILD">BUILD</option><option value="OPS">OPS</option>
      </select>
      <select className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={String(form.priority)} onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))}>
        <option value="0">LOW</option><option value="1">MEDIUM</option><option value="2">HIGH</option>
      </select>
      <select className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={form.assignedAgentId ?? ""} onChange={(e) => setForm((p) => ({ ...p, assignedAgentId: e.target.value || null }))}>
        <option value="">Unassigned</option>
        {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select>
      <Button type="submit">Save</Button>
    </form>
  );
}
