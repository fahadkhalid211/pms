"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Wrench, CheckCircle2, Play, AlertOctagon, RefreshCw, Ban } from "lucide-react";

interface Ticket {
  id: string;
  status: string;
  priority: string;
  description: string;
  propertyId: string;
  roomId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  room: { id: string; number: string; status: string } | null;
}

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  propertyId: string;
  status: string;
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);

  // New ticket state
  const [roomId, setRoomId] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [description, setDescription] = React.useState("");
  const [blockRoom, setBlockRoom] = React.useState(false);
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async (propId?: string) => {
    setLoading(true);
    try {
      const pId = propId || selectedPropertyId;
      const ticketsUrl = pId ? `/api/maintenance?propertyId=${pId}` : "/api/maintenance";
      const res = await fetch(ticketsUrl);
      const json = await res.json();
      if (res.ok && json.success) setTickets(json.data);

      const propsRes = await fetch("/api/properties");
      const propsJson = await propsRes.json();
      if (propsRes.ok && propsJson.success && propsJson.data.length > 0) {
        setProperties(propsJson.data);
        if (!selectedPropertyId && !propId) {
          setSelectedPropertyId(propsJson.data[0].id);
        }
      }

      const roomsUrl = pId ? `/api/rooms?propertyId=${pId}` : "/api/rooms";
      const roomsRes = await fetch(roomsUrl);
      const roomsJson = await roomsRes.json();
      if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data ?? []);
    } catch (e: any) {
      toast({ title: "Failed to load maintenance tickets", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handlePropertyChange(propId: string) {
    setSelectedPropertyId(propId);
    setRoomId("");
    await load(propId);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPropertyId) {
      setError("Please select a property.");
      return;
    }
    if (!description.trim()) {
      setError("Please enter an issue description.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          roomId: roomId || undefined,
          priority,
          description: description.trim(),
          blockRoom: blockRoom && Boolean(roomId),
          startDate: blockRoom ? startDate : undefined,
          endDate: blockRoom ? endDate : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to create ticket");
        return;
      }

      toast({
        title: "Work order created",
        description: blockRoom
          ? "Room inventory blocked and marked out of service."
          : "Maintenance team notified.",
      });
      setDescription("");
      setRoomId("");
      setBlockRoom(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error creating ticket");
    } finally {
      setPending(false);
    }
  }

  async function updateTicketStatus(ticketId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/maintenance/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Failed to update ticket", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({
        title: `Work order: ${newStatus.replace(/_/g, " ")}`,
        description: newStatus === "resolved" ? "Maintenance inventory block removed and room restored." : undefined,
      });
      await load();
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message, variant: "destructive" });
    }
  }

  const activeRooms = selectedPropertyId ? rooms.filter((r) => r.propertyId === selectedPropertyId) : rooms;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maintenance & Facility Orders</h1>
          <p className="text-muted-foreground">Log work orders, track repairs, and manage out-of-order room blocks.</p>
        </div>
        <div className="flex items-center gap-2">
          {properties.length > 1 && (
            <Select value={selectedPropertyId} onChange={(e) => void handlePropertyChange(e.target.value)}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ticket List Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Maintenance Tickets ({tickets.length})</CardTitle>
            <CardDescription>Resolving tickets automatically releases inventory maintenance blocks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading maintenance tickets…</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open maintenance orders.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="flex flex-col gap-3 rounded-lg border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{t.description}</span>
                      <Badge
                        variant={
                          t.priority === "emergency"
                            ? "destructive"
                            : t.priority === "high"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {t.priority}
                      </Badge>
                      <Badge variant={t.status === "resolved" ? "default" : t.status === "in_progress" ? "secondary" : "muted"}>
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t.room ? (
                        <>
                          Room {t.room.number} · Current status:{" "}
                          <span className="font-medium text-foreground">{t.room.status}</span>
                        </>
                      ) : (
                        "General Facility / Common Area"
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {t.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => void updateTicketStatus(t.id, "in_progress")}>
                        <Play className="mr-1 h-3.5 w-3.5" /> In Progress
                      </Button>
                    )}
                    {t.status === "in_progress" && (
                      <Button size="sm" variant="default" onClick={() => void updateTicketStatus(t.id, "resolved")}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolve & Restore
                      </Button>
                    )}
                    {t.status === "resolved" && (
                      <Badge variant="secondary" className="text-emerald-600">
                        Resolved
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Create Ticket Form */}
        <Card>
          <CardHeader>
            <CardTitle>Log Work Order</CardTitle>
            <CardDescription>Create ticket and optionally block inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3.5" onSubmit={onSubmit}>
              {properties.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Property</Label>
                  <Select value={selectedPropertyId} onChange={(e) => void handlePropertyChange(e.target.value)}>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Location / Room</Label>
                <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">General property (No specific room)</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.number} ({r.status})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mdesc">Issue Description</Label>
                <Input
                  id="mdesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. AC leaking, broken shower door"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mpriority">Urgency / Priority</Label>
                <Select id="mpriority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="emergency">Emergency / Critical</option>
                </Select>
              </div>

              {/* Maintenance Block Option */}
              {Boolean(roomId) && (
                <div className="space-y-2.5 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="blockRoomCheckbox"
                      checked={blockRoom}
                      onChange={(e) => setBlockRoom(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary"
                    />
                    <Label htmlFor="blockRoomCheckbox" className="text-xs font-semibold flex items-center gap-1 text-rose-600">
                      <Ban className="h-3.5 w-3.5" />
                      Block Inventory (Out of Order)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Creates maintenance RoomNight records preventing reservations on these dates.
                  </p>

                  {blockRoom && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <Label htmlFor="blkStart" className="text-[11px]">Start Date</Label>
                        <Input
                          id="blkStart"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="blkEnd" className="text-[11px]">End Date</Label>
                        <Input
                          id="blkEnd"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>}

              <Button type="submit" className="w-full" disabled={pending || !description.trim()}>
                {pending ? "Logging Work Order…" : "Log Work Order"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
