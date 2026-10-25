"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Room {
  id: string;
  number: string;
  status: string;
  roomType: { id: string; name: string; capacity: number; baseRate: string | number } | null;
  property?: { id: string; name: string };
}

interface RoomType {
  id: string;
  name: string;
  capacity: number;
  bedType: string | null;
  baseRate: string | number;
  property?: { id: string; name: string };
  _count?: { rooms: number };
}

interface Property {
  id: string;
  name: string;
  currency: string;
}

export default function RoomsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"rooms" | "roomTypes">("rooms");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  
  // Room form
  const [propertyId, setPropertyId] = React.useState("");
  const [roomTypeId, setRoomTypeId] = React.useState("");
  const [number, setNumber] = React.useState("");
  
  // Room Type form
  const [rtPropertyId, setRtPropertyId] = React.useState("");
  const [rtName, setRtName] = React.useState("");
  const [rtCapacity, setRtCapacity] = React.useState(2);
  const [rtBedType, setRtBedType] = React.useState("King");
  const [rtBaseRate, setRtBaseRate] = React.useState("120");

  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [roomsRes, typesRes, propsRes] = await Promise.all([
        fetch("/api/rooms"),
        fetch("/api/roomtypes"),
        fetch("/api/properties"),
      ]);

      const [roomsJson, typesJson, propsJson] = await Promise.all([
        roomsRes.json(),
        typesRes.json(),
        propsRes.json(),
      ]);

      if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data);
      if (typesRes.ok && typesJson.success) setRoomTypes(typesJson.data);
      if (propsRes.ok && propsJson.success) {
        setProperties(propsJson.data);
        if (propsJson.data.length > 0) {
          if (!propertyId) setPropertyId(propsJson.data[0].id);
          if (!rtPropertyId) setRtPropertyId(propsJson.data[0].id);
        }
      }
    } catch {
      setError("Failed to load inventory data");
    }
  }, [propertyId, rtPropertyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onAddRoom(e: React.FormEvent) {
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
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to create room");
      return;
    }
    toast({ title: "Room added successfully" });
    setNumber("");
    await load();
  }

  async function onAddRoomType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/roomtypes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: rtPropertyId,
        name: rtName,
        capacity: rtCapacity,
        bedType: rtBedType,
        baseRate: rtBaseRate,
      }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to create room type");
      return;
    }
    toast({ title: "Room type added successfully" });
    setRtName("");
    setRtBaseRate("120");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms & Room Types</h1>
          <p className="text-muted-foreground">Manage your physical rooms, categories, base pricing, and capacities.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "rooms" ? "default" : "outline"}
            onClick={() => { setActiveTab("rooms"); setError(null); }}
          >
            Rooms ({rooms.length})
          </Button>
          <Button
            variant={activeTab === "roomTypes" ? "default" : "outline"}
            onClick={() => { setActiveTab("roomTypes"); setError(null); }}
          >
            Room Types ({roomTypes.length})
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      {activeTab === "rooms" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add New Room</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <form className="grid gap-3 sm:grid-cols-4" onSubmit={onAddRoom}>
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                    <option value="">Select property…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
                    <option value="">Select type…</option>
                    {roomTypes
                      .filter((t) => !propertyId || !t.property || t.property.id === propertyId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (${Number(t.baseRate).toFixed(2)})
                        </option>
                      ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Number</Label>
                  <Input
                    placeholder="e.g. 101"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={pending || !propertyId || !roomTypeId || !number}
                  >
                    {pending ? "Adding…" : "Add Room"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-3 text-left">Room Number</th>
                      <th className="p-3 text-left">Room Type</th>
                      <th className="p-3 text-left">Base Rate</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground">
                          No rooms yet. Add your first room above or use the Setup Wizard.
                        </td>
                      </tr>
                    ) : (
                      rooms.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="p-3 font-semibold">Room {r.number}</td>
                          <td className="p-3">{r.roomType?.name ?? "—"}</td>
                          <td className="p-3">
                            {r.roomType?.baseRate ? `$${Number(r.roomType.baseRate).toFixed(2)} / night` : "—"}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                r.status === "available"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : r.status === "occupied"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {r.status.replace(/_/g, " ")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add New Room Type</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <form className="grid gap-3 sm:grid-cols-5" onSubmit={onAddRoomType}>
                <div className="space-y-2">
                  <Label>Property</Label>
                  <Select value={rtPropertyId} onChange={(e) => setRtPropertyId(e.target.value)}>
                    <option value="">Select property…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category Name</Label>
                  <Input
                    placeholder="e.g. Deluxe Suite"
                    value={rtName}
                    onChange={(e) => setRtName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacity (Guests)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={rtCapacity}
                    onChange={(e) => setRtCapacity(parseInt(e.target.value, 10) || 2)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bed Configuration</Label>
                  <Input
                    placeholder="e.g. 1 King Bed"
                    value={rtBedType}
                    onChange={(e) => setRtBedType(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base Nightly Rate ($)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rtBaseRate}
                      onChange={(e) => setRtBaseRate(e.target.value)}
                      required
                    />
                    <Button type="submit" disabled={pending || !rtPropertyId || !rtName || !rtBaseRate}>
                      {pending ? "…" : "Add"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-3 text-left">Category Name</th>
                      <th className="p-3 text-left">Bedding</th>
                      <th className="p-3 text-left">Max Capacity</th>
                      <th className="p-3 text-left">Base Rate</th>
                      <th className="p-3 text-left">Assigned Rooms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomTypes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No room types configured. Add your first room type above.
                        </td>
                      </tr>
                    ) : (
                      roomTypes.map((rt) => (
                        <tr key={rt.id} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="p-3 font-semibold">{rt.name}</td>
                          <td className="p-3">{rt.bedType ?? "Standard"}</td>
                          <td className="p-3">{rt.capacity} guests</td>
                          <td className="p-3 font-medium">${Number(rt.baseRate).toFixed(2)} / night</td>
                          <td className="p-3 text-muted-foreground">{rt._count?.rooms ?? 0} room(s)</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
