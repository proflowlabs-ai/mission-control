import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Agent = { id: string; name: string };
type Task = { id: string; status: string };

type Message = { role: "User" | "Agent"; content: string };

export default function ChatPage() {
  const { query } = useRouter();
  const projectId = query.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [agent, setAgent] = useState("cody");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!projectId) return;
    void fetch("/api/agents").then((r) => r.json()).then((d) => {
      const incoming = d.agents ?? [];
      setAgents(incoming);
      if (incoming[0]) setAgent(incoming[0].id);
    });
    void fetch(`/api/tasks?projectId=${projectId}`).then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
  }, [projectId]);

  const taskSummary = useMemo(() => {
    const byStatus = tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ");
  }, [tasks]);

  const streamReply = (content: string) => {
    const planned = `[${agent}] Received: "${content}". Current project status → ${taskSummary || "no task data"}.`;
    let i = 0;
    setMessages((prev) => [...prev, { role: "Agent", content: "" }]);

    const timer = setInterval(() => {
      i += 3;
      setMessages((prev) => {
        const clone = [...prev];
        const idx = clone.length - 1;
        clone[idx] = { role: "Agent", content: planned.slice(0, i) };
        return clone;
      });
      if (i >= planned.length) clearInterval(timer);
    }, 35);
  };

  const send = () => {
    if (!input.trim()) return;
    const message = input;
    setMessages((prev) => [...prev, { role: "User", content: message }]);
    setInput("");
    streamReply(message);
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Project Chat</h1>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-400">Agent</label>
        <select className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm" value={agent} onChange={(e) => setAgent(e.target.value)}>
          {agents.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-3 min-h-[300px] space-y-3">
        {messages.map((message, i) => (
          <div key={i} className="text-sm">
            <strong className="text-slate-200">{message.role}:</strong> <span className="text-slate-300">{message.content}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
