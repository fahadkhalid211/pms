"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Ticket {
  id: string;
  status: string;
  priority: string;
  description: string;
  room: { number: string } | null;
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [roomId, setRoomId] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function load() {
    const res = await fetch("/api/maintenance");
    const json = await res.json();
    if (res.ok && json.success) setTickets(json.data);
    const roomsRes = await fetch("/api/rooms");
    const roomsJson = await roomsRes.json();
    if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data);
  }

  React.useEffect(() => { void load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: "prop-1", roomId, priority, description }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) { setError(json.error?.message ?? "Failed to create ticket"); return; }
    toast({ title: "Maintenance ticket created" });
    setDescription("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
        <p className="text-muted-foreground">Work orders and repairs.</p>
      </div>
      <Card>
        <CardContent className="space-y-2">
          {tickets.length === 0 ? <p className="text-sm text-muted-foreground">No maintenance tickets.</p> : tickets.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{t.description}</div>
                <div className="text-sm text-muted-foreground">Room {t.room?.number ?? "—"} · {t.priority}</div>
              </div>
              <Badge variant={t.status === "resolved" ? "default" : "secondary"}>{t.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>New work order</CardTitle></CardHeader>
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
              <Label htmlFor="mdesc">Issue description</Label>
              <Input id="mdesc" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mpriority">Priority</Label>
              <Select id="mpriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </Select>
            </div>
            {error ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
            <Button type="submit" disabled={pending || !roomId || !description}>{pending ? "Creating…" : "Create work order"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
