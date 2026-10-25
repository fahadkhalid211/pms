"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface ChatMessage {
  role: string;
  content: string;
}

export default function AiChatbotAdminPage() {
  const { toast } = useToast();
  const [sessionKey, setSessionKey] = React.useState(`guest-${Date.now().toString(36)}`);
  const [messages, setMessages] = React.useState<ChatMessage[]>([{ role: "assistant", content: "Welcome! How can I help you today?" }]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [reply, setReply] = React.useState<string | null>(null);

  async function send() {
    const message = input.trim();
    if (!message || pending) return;
    setInput("");
    setPending(true);
    const res = await fetch("/api/chatbot/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionKey }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) {
      setMessages((prev) => [...prev, { role: "assistant", content: json.error?.message ?? "Chatbot failed" }]);
      toast({ title: "Chatbot failed", description: json.error?.message, variant: "destructive" });
      return;
    }
    const data = json.data;
    setReply(data?.reply ?? null);
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: data?.reply ?? "" }]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Chatbot test console</CardTitle><CardDescription>Test guest-facing responses.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border p-4">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary/10" : "bg-muted"}`}>
                <div className="font-medium">{m.role === "user" ? "Guest" : "Bot"}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} className="h-9 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about check-in…" className="min-h-[60px]" />
            <Button onClick={() => void send()} disabled={pending || !input.trim()}>Send</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Last reply</CardTitle></CardHeader>
        <CardContent><div className="rounded-lg bg-muted p-4 text-sm">{reply ?? "—"}</div></CardContent>
      </Card>
    </div>
  );
}
