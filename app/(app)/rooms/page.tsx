"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Room {
  id: string;
  number: string;
  status: string;
  roomType: { id: string; name: string; capacity: number; baseRate: number } | null;
}

interface RoomType {
  id: string;
  name: string;
}

export default function RoomsPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([]);
  const [properties, setProperties] = React.useState<any[]>([]);
  const [propertyId, setPropertyId] = React.useState("");
  const [roomTypeId, setRoomTypeId] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function load() {
    const res = await fetch("/api/rooms");
    const json = await res.json();
    if (res.ok && json.success) setRooms(json.data);
    const typesRes = await fetch("/api/roomtypes");
    const typesJson = await typesRes.json();
    if (typesRes.ok && typesJson.success) setRoomTypes(typesJson.data);
    const propsRes = await fetch("/api/properties");
    const propsJson = await propsRes.json();
    if (propsRes.ok && propsJson.success) setProperties(propsJson.data);
  }

  React.useEffect(() => { void load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, roomTypeId, number, status: "available" }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) { setError(json.error?.message ?? "Failed to create room"); return; }
    toast({ title: "Room added" });
    setNumber("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
        <p className="text-muted-foreground">Room inventory and status.</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-4" onSubmit={onSubmit}>
            <div className="space-y-2"><Label>Property</Label><Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Select…</option>{properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Room type</Label><Select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}><option value="">Select…</option>{roomTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Room number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
            <div className="flex items-end"><Button type="submit" disabled={pending || !propertyId || !roomTypeId || !number}>{pending ? "Adding…" : "Add room"}</Button></div>
          </form>
          {error ? <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="p-3 text-left">Room</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Status</th></tr></thead>
              <tbody>
                {rooms.length === 0 ? <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No rooms yet.</td></tr> : rooms.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">Room {r.number}</td>
                    <td className="p-3">{r.roomType?.name ?? "—"}</td>
                    <td className="p-3"><span className="capitalize">{r.status.replace(/_/g, " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
