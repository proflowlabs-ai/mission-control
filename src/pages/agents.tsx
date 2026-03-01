import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Array<{ id: string; name: string; model: string; capabilities: string[] }>>([]);

  useEffect(() => {
    void fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? []));
  }, []);

  return (
    <main className="p-6 grid gap-3 md:grid-cols-2">
      {agents.map((agent) => (
        <Card key={agent.id}>
          <CardHeader><CardTitle>{agent.name}</CardTitle></CardHeader>
          <CardContent>
            <div>{agent.model}</div>
            <div className="text-sm text-muted-foreground">{agent.capabilities.join(", ")}</div>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
