import { useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChatPage() {
  const { query } = useRouter();
  const projectId = query.id as string;
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [agent, setAgent] = useState("cody");

  const send = () => {
    if (!input) return;
    setMessages((prev) => [...prev, { role: "User", content: input }, { role: "Agent", content: `[${agent}] streaming response placeholder...` }]);
    setInput("");
  };

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-bold">Project Chat #{projectId}</h1>
      <select className="border rounded px-2 py-1" value={agent} onChange={(e) => setAgent(e.target.value)}>
        <option value="cody">cody</option>
        <option value="alex">alex</option>
      </select>
      <div className="rounded border p-3 min-h-[200px] space-y-2">
        {messages.map((message, i) => <div key={i}><strong>{message.role}:</strong> {message.content}</div>)}
      </div>
      <div className="flex gap-2"><Input value={input} onChange={(e) => setInput(e.target.value)} /><Button onClick={send}>Send</Button></div>
    </main>
  );
}
