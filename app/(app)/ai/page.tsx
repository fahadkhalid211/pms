"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface ChatMessage {
  role: string;
  content: string | null;
}

interface Execution {
  id: string;
  status: string;
  requestSummary: string;
  finalSummary: string | null;
  error: string | null;
}

export default function AiOperationsPage() {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessage[]>([{ role: "assistant", content: "Hello. I can help with arrivals, availability, reservations, housekeeping, billing, and reports. What would you like me to do?" }]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [executions, setExecutions] = React.useState<Execution[]>([]);
  const [awaiting, setAwaiting] = React.useState<string | null>(null);

  async function loadExecutions() {
    const res = await fetch("/api/ai/executions");
    const json = await res.json();
    if (res.ok && json.success) setExecutions(json.data);
  }

  React.useEffect(() => { void loadExecutions(); }, []);

  async function send() {
    const message = input.trim();
    if (!message || pending) return;
    setInput("");
    setPending(true);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    const res = await fetch("/api/ai/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setMessages((prev) => [...prev, { role: "assistant", content: json.error?.message ?? "Agent failed" }]);
      setPending(false);
      return;
    }
    const outcome = json.data;
    if (outcome.status === "awaiting_approval") {
      setAwaiting(outcome.approvalId ?? null);
      setMessages((prev) => [...prev, { role: "assistant", content: `I need your approval to run this action: ${outcome.approvalId}` }]);
    } else {
      setMessages((prev) => [...prev, { role: "assistant", content: outcome.finalContent ?? (outcome.error ? `Error: ${outcome.error}` : "Done.") }]);
      if (outcome.status === "failed") toast({ title: "Agent failed", description: outcome.error, variant: "destructive" });
    }
    setPending(false);
    await loadExecutions();
  }

  async function approve() {
    if (!awaiting) return;
    const res = await fetch(`/api/ai/approvals/${awaiting}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast({ title: "Approval failed", description: json.error?.message, variant: "destructive" });
      return;
    }
    setAwaiting(null);
    setMessages((prev) => [...prev, { role: "assistant", content: "The approved action has been executed." }]);
    await loadExecutions();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>AI operations agent</CardTitle><CardDescription>Autonomous, permission-aware actions against your PMS.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border p-4">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary/10" : "bg-muted"}`}>
                <div className="font-medium">{m.role === "user" ? "You" : "Agent"}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Show all arrivals expected tomorrow" className="min-h-[60px]" />
            <Button onClick={() => void send()} disabled={pending || !input.trim()}>Send</Button>
          </div>
          {awaiting ? (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <div>An action requires approval. Approve to execute?</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => void approve()}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => setAwaiting(null)}>Reject</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Executions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {executions.length === 0 ? <p className="text-sm text-muted-foreground">No executions yet.</p> : executions.map((e) => (
            <div key={e.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">#{e.id.slice(0, 8)}</span>
                <Badge variant={e.status === "completed" ? "default" : e.status === "failed" ? "destructive" : "secondary"}>{e.status}</Badge>
              </div>
              <div className="mt-1 text-sm">{e.requestSummary}</div>
              {e.finalSummary ? <div className="mt-1 text-sm text-muted-foreground">{e.finalSummary}</div> : null}
              {e.error ? <div className="mt-1 text-sm text-destructive">{e.error}</div> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
