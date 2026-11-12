"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Calendar,
  Sparkles,
  Wrench,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

interface RoomDetail {
  id: string;
  number: string;
  name: string | null;
  floor: string | null;
  status: string;
  property: { id: string; name: string; code: string; currency: string };
  roomType: { id: string; name: string; capacity: number; bedType: string | null; baseRate: string | number };
  reservations: Array<{
    id: string;
    code: string;
    status: string;
    checkIn: string;
    checkOut: string;
    totalAmount: string | number;
    currency: string;
    guest?: { id: string; firstName: string; lastName: string; email: string | null } | null;
  }>;
  housekeepingTasks: Array<{
    id: string;
    title: string | null;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  maintenanceTickets: Array<{
    id: string;
    description: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
}

const ROOM_STATUSES = ["available", "clean", "dirty", "inspected", "occupied", "out_of_service"] as const;

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const roomId = params?.id;
  const { toast } = useToast();

  const [room, setRoom] = React.useState<RoomDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Room not found.");
      } else {
        setRoom(json.data as RoomDetail);
      }
    } catch {
      setError("Failed to load room details.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(nextStatus: string) {
    if (!room) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Status update failed", description: json.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Room status updated", description: `Room ${room.number} is now ${nextStatus.replace(/_/g, " ")}.` });
        await load();
      }
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading && !room) {
    return (
      <div className="space-y-6">
        <Link href="/rooms" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Rooms
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading room details...</CardContent></Card>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="space-y-6">
        <Link href="/rooms" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Rooms
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-destructive">{error || "Room not found."}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/calendar" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Calendar
            </Link>
            <span>/</span>
            <Link href="/rooms" className="hover:text-foreground">Rooms</Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BedDouble className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Room {room.number}</h1>
                {room.name && <span className="text-sm text-muted-foreground">({room.name})</span>}
                <Badge variant="outline" className="capitalize text-xs">{room.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <Link href={`/properties/${room.property.id}`} className="inline-flex items-center gap-1 hover:text-primary font-medium">
                  <Building2 className="h-3.5 w-3.5" /> {room.property.name}
                </Link>
                <span>· {room.roomType.name} (Cap {room.roomType.capacity})</span>
                <span>· {room.property.currency} {Number(room.roomType.baseRate).toFixed(2)}/night</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Room status"
            value={room.status}
            disabled={updatingStatus}
            onChange={(e) => void handleStatusChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium capitalize"
          >
            {ROOM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} /> Reservations for Room {room.number} ({room.reservations.length})
            </CardTitle>
            <CardDescription className="text-xs">Click any booking or guest name to inspect full details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {room.reservations.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No bookings assigned to this room yet.</p>
            ) : (
              room.reservations.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 hover:border-primary/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/reservations/${r.id}`} className="font-mono font-bold text-primary hover:underline">
                        {r.code}
                      </Link>
                      <Badge variant={r.status === "cancelled" ? "destructive" : "default"} className="capitalize text-[10px]">
                        {r.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span>{new Date(r.checkIn).toISOString().slice(0, 10)} → {new Date(r.checkOut).toISOString().slice(0, 10)}</span>
                      {r.guest && (
                        <Link href={`/guests/${r.guest.id}`} className="hover:text-primary font-medium">
                          {r.guest.firstName} {r.guest.lastName}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{r.currency} {Number(r.totalAmount).toFixed(2)}</span>
                    <Link href={`/reservations/${r.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        Open <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} /> Housekeeping Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {room.housekeepingTasks.length === 0 ? (
                <p className="text-muted-foreground">No tasks logged.</p>
              ) : (
                room.housekeepingTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <div className="font-semibold">{t.title || "Room turnover"}</div>
                      <div className="text-muted-foreground">Priority: {t.priority}</div>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{t.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" strokeWidth={1.5} /> Maintenance Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {room.maintenanceTickets.length === 0 ? (
                <p className="text-muted-foreground">No maintenance tickets logged.</p>
              ) : (
                room.maintenanceTickets.map((mt) => (
                  <div key={mt.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <div className="font-semibold line-clamp-1">{mt.description}</div>
                      <div className="text-muted-foreground">Priority: {mt.priority}</div>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{mt.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
