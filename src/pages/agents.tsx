import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Agent = { id: string; name: string; model: string; capabilities?: string[] | string; description?: string };

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    void fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          let capabilities: string[] = [];
          if (Array.isArray(agent.capabilities)) {
            capabilities = agent.capabilities;
          } else if (typeof agent.capabilities === "string") {
            try {
              capabilities = JSON.parse(agent.capabilities || "[]") as string[];
            } catch {
              capabilities = [];
            }
          }

          return (
            <Card key={agent.id} className="border-slate-800 bg-slate-900/60">
              <CardHeader><CardTitle>{agent.name}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-slate-300">ID: {agent.id}</div>
                <div className="text-slate-300">Model: {agent.model}</div>
                <div className="flex flex-wrap gap-1">
                  {capabilities.map((capability: string) => (
                    <Badge key={`${agent.id}-${capability}`} variant="outline">{capability}</Badge>
                  ))}
                </div>
                <div className="text-emerald-300">Status: online</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
