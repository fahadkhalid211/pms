"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Task {
  id: string;
  status: string;
  priority: string;
  title: string | null;
  room: { number: string; roomType: { name: string } | null } | null;
}

export default function HousekeepingPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [roomId, setRoomId] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [title, setTitle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function load() {
    const res = await fetch("/api/housekeeping");
    const json = await res.json();
    if (res.ok && json.success) setTasks(json.data);
  }

  React.useEffect(() => {
    void (async () => {
      const roomsRes = await fetch("/api/rooms");
      const roomsJson = await roomsRes.json();
      if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data);
      await load();
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/housekeeping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: "prop-1", roomId, status: "pending", priority, title }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) { setError(json.error?.message ?? "Failed to create task"); return; }
    toast({ title: "Housekeeping task created" });
    setTitle("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Housekeeping</h1>
        <p className="text-muted-foreground">Cleaning task assignment and tracking.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-2">
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks yet.</p> : tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{t.title ?? "Cleaning"}</div>
                  <div className="text-sm text-muted-foreground">Room {t.room?.number ?? "—"} · {t.room?.roomType?.name ?? ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "default" : "secondary"}>{t.priority}</Badge>
                  <Badge variant={t.status === "completed" ? "default" : "muted"}>{t.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>New task</CardTitle><CardDescription>Assign a cleaning task.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label>Room</Label>
                <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Select room…</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="htitle">Task</Label>
                <Input id="htitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deep clean" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hpriority">Priority</Label>
                <Select id="hpriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </Select>
              </div>
              {error ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
              <Button type="submit" disabled={pending || !roomId}>{pending ? "Creating…" : "Create task"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
