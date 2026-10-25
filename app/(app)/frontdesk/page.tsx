"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface Reservation {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guest: { firstName: string; lastName: string } | null;
}

export default function FrontDeskPage() {
  const { toast } = useToast();
  const [arrivals, setArrivals] = React.useState<Reservation[]>([]);
  const [departures, setDepartures] = React.useState<Reservation[]>([]);
  const [rooms, setRooms] = React.useState<{ id: string; number: string; status: string }[]>([]);
  const [outstanding, setOutstanding] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  const todayKey = new Date().toDateString();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/reservations?pageSize=100");
    const json = await res.json();
    if (res.ok && json.success) {
      const all: Reservation[] = json.data.items ?? [];
      setArrivals(all.filter((r) => new Date(r.checkIn).toDateString() === todayKey));
      setDepartures(all.filter((r) => new Date(r.checkOut).toDateString() === todayKey));
    }
    const roomsRes = await fetch("/api/rooms");
    const roomsJson = await roomsRes.json();
    if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data ?? []);
    const invRes = await fetch("/api/invoices");
    const invJson = await invRes.json();
    if (invRes.ok && invJson.success) {
      const open = (invJson.data?.invoices ?? []).filter((i: { status: string }) => ["issued", "overdue"].includes(i.status));
      setOutstanding(open.reduce((acc: number, i: { total: number }) => acc + Number(i.total ?? 0), 0));
    }
    setLoading(false);
  }

  React.useEffect(() => { void load(); }, []);

  async function setStatus(id: string, status: string, code: string) {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast({ title: "Action failed", description: json.error?.message ?? "Could not update", variant: "destructive" });
      return;
    }
    toast({ title: `Reservation ${code} → ${status.replace(/_/g, " ")}` });
    await load();
  }

  const occupied = rooms.filter((r) => r.status === "occupied").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Front Desk</h1>
        <p className="text-muted-foreground">Today&apos;s arrivals, departures, and operational readiness.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Arrivals today</div><div className="text-2xl font-bold">{arrivals.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Departures today</div><div className="text-2xl font-bold">{departures.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Occupied</div><div className="text-2xl font-bold">{occupied}</div><div className="text-xs text-muted-foreground">of {rooms.length} rooms</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Outstanding balances</div><div className="text-2xl font-bold">${outstanding.toFixed(2)}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Arrivals</CardTitle><CardDescription>Expected arrivals for today.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : arrivals.length === 0 ? <p className="text-sm text-muted-foreground">No arrivals today.</p> : arrivals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Walk-in"}</div>
                  <div className="text-sm text-muted-foreground">{r.code} · {r.adults + r.children} guests</div>
                </div>
                <div className="flex gap-2">
                  {r.status === "confirmed" && <Button size="sm" onClick={() => void setStatus(r.id, "checked_in", r.code)}>Check in</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Departures</CardTitle><CardDescription>Expected departures for today.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : departures.length === 0 ? <p className="text-sm text-muted-foreground">No departures today.</p> : departures.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Walk-in"}</div>
                  <div className="text-sm text-muted-foreground">{r.code}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, "checked_out", r.code)}>Check out</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
