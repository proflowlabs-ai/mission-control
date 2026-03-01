import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<Array<{ id: string; name: string; enabled: boolean; nextRunAt?: string; runs?: { id: string; status: string }[] }>>([]);

  const load = () => void fetch("http://127.0.0.1:4000/api/scheduler").then((r) => r.json()).then((d) => setJobs(d.jobs ?? []));
  useEffect(load, []);

  return (
    <main className="p-6 space-y-4">
      <div className="flex justify-between"><h1 className="text-2xl font-bold">Scheduler</h1><Button>New Job</Button></div>
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader><CardTitle>{job.name}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div>Next run: {job.nextRunAt ?? "n/a"}</div>
            <div className="flex items-center gap-2">
              <Switch checked={job.enabled} onCheckedChange={(checked) => {
                void fetch(`http://127.0.0.1:4000/api/scheduler/${job.id}/${checked ? "enable" : "disable"}`, { method: "PUT" }).then(load);
              }} />
              <Button variant="outline" onClick={() => void fetch(`http://127.0.0.1:4000/api/scheduler/${job.id}/run-now`, { method: "POST" })}>Run now</Button>
            </div>
            <div className="text-xs">Run history: {job.runs?.map((run) => `${run.id}:${run.status}`).join(" | ") || "none"}</div>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
