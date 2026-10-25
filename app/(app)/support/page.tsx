"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Conversation {
  id: string;
  status: string;
  channel: string;
  messages: { role: string; content: string; createdAt: string }[];
}

export default function SupportPage() {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/chatbot");
      const json = await res.json();
      if (res.ok && json.success) setConversations(json.data?.conversations ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer support</h1>
        <p className="text-muted-foreground">Support conversations and escalation.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Conversations</CardTitle><CardDescription>Latest customer conversations.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : conversations.length === 0 ? <p className="text-sm text-muted-foreground">No conversations yet.</p> : conversations.map((c) => (
            <div key={c.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">#{c.id.slice(0, 8)}</span>
                <Badge variant={c.status === "open" ? "default" : "muted"}>{c.status}</Badge>
              </div>
              <div className="mt-2 space-y-2">
                {c.messages.slice(-4).map((m, i) => (
                  <div key={i} className="rounded bg-muted p-2 text-sm">
                    <span className="font-medium">{m.role}: </span>
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
