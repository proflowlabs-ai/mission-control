import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; timestamp?: string }>({ status: "unknown" });

  useEffect(() => {
    void fetch("/health").then((r) => r.json()).then((d) => setHealth(d));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader><CardTitle>System</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Status: {health.status}</div>
          <div>Last heartbeat: {health.timestamp ? new Date(health.timestamp).toLocaleString() : "n/a"}</div>
          <div>Backend API: http://127.0.0.1:4000</div>
        </CardContent>
      </Card>
    </div>
  );
}
