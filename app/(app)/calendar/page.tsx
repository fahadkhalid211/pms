"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Move,
  Building2,
  BedDouble,
  User,
  ExternalLink,
  Plus,
  CheckCircle2,
  LogOut,
  XCircle,
  Search,
} from "lucide-react";

interface PropertyItem {
  id: string;
  name: string;
  code: string;
  currency: string;
}

interface Room {
  id: string;
  propertyId: string;
  number: string;
  name: string | null;
  status: string;
  roomType?: { id: string; name: string; baseRate: string | number; capacity: number };
  property?: PropertyItem;
}

interface ReservationRoom {
  roomId: string;
  room: { id: string; number: string; name?: string | null; status: string; roomType?: { name: string } };
}

interface Reservation {
  id: string;
  propertyId: string;
  code: string;
  status: string;
  source: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: string | number;
  currency: string;
  notes: string | null;
  property?: PropertyItem | null;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  rooms?: ReservationRoom[];
}

function getTodayUtcIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractIsoDate(value: string): string {
  return value.slice(0, 10);
}

function addDaysIso(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function diffDaysIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map((n) => Number.parseInt(n, 10));
  const [y2, m2, d2] = toIso.split("-").map((n) => Number.parseInt(n, 10));
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / 86400000);
}

function formatDayHeader(isoDate: string): { weekday: string; dayNum: string; month: string } {
  const [y, m, d] = isoDate.split("-").map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: dt.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
    dayNum: String(dt.getUTCDate()),
    month: dt.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }),
  };
}

function bookingBarStyles(status: string): string {
  switch (status) {
    case "checked_in":
      return "bg-blue-600 text-white border-blue-700 hover:bg-blue-700";
    case "confirmed":
      return "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700";
    case "pending":
    case "draft":
      return "bg-amber-400 text-slate-950 border-amber-500 hover:bg-amber-500";
    case "checked_out":
      return "bg-slate-500 text-white border-slate-600 hover:bg-slate-600";
    case "cancelled":
    case "no_show":
      return "bg-rose-100 text-rose-800 border-rose-300 line-through opacity-75";
    default:
      return "bg-violet-600 text-white border-violet-700 hover:bg-violet-700";
  }
}

export default function CalendarPage() {
  const { toast } = useToast();
  const todayIso = React.useMemo(() => getTodayUtcIso(), []);

  const [startDateIso, setStartDateIso] = React.useState<string>(() => addDaysIso(getTodayUtcIso(), -1));
  const [daysCount, setDaysCount] = React.useState<number>(14);
  const [properties, setProperties] = React.useState<PropertyItem[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [propertyFilter, setPropertyFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [searchTerm, setSearchTerm] = React.useState<string>("");

  // Drag & Drop state
  const [draggedItem, setDraggedItem] = React.useState<{
    reservationId: string;
    code: string;
    sourceRoomId: string;
  } | null>(null);
  const [dropTargetRoomId, setDropTargetRoomId] = React.useState<string | null>(null);

  // Selected Booking Drawer/Modal
  const [selectedBooking, setSelectedBooking] = React.useState<Reservation | null>(null);
  const [actionBusy, setActionBusy] = React.useState(false);

  // Quick Create Booking Modal (when clicking an empty cell)
  const [quickBookOpen, setQuickBookOpen] = React.useState(false);
  const [quickTarget, setQuickTarget] = React.useState<{ propertyId: string; propertyName: string; roomId: string; roomLabel: string } | null>(null);
  const [qbCheckIn, setQbCheckIn] = React.useState("");
  const [qbCheckOut, setQbCheckOut] = React.useState("");
  const [qbFirstName, setQbFirstName] = React.useState("");
  const [qbLastName, setQbLastName] = React.useState("");
  const [qbEmail, setQbEmail] = React.useState("");
  const [qbPhone, setQbPhone] = React.useState("");
  const [qbAdults, setQbAdults] = React.useState(2);
  const [qbSource, setQbSource] = React.useState("direct");
  const [qbNotes, setQbNotes] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [propsRes, roomsRes, resRes] = await Promise.all([
        fetch("/api/properties"),
        fetch("/api/rooms"),
        fetch("/api/reservations?pageSize=250"),
      ]);
      const [propsJson, roomsJson, resJson] = await Promise.all([
        propsRes.json(),
        roomsRes.json(),
        resRes.json(),
      ]);

      if (propsRes.ok && propsJson.success) setProperties(propsJson.data ?? []);
      if (roomsRes.ok && roomsJson.success) setRooms(roomsJson.data ?? []);
      if (resRes.ok && resJson.success) setReservations(resJson.data.items ?? []);
    } catch (e: unknown) {
      toast({ title: "Failed to load calendar", description: (e as Error)?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const dateColumns = React.useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      cols.push(addDaysIso(startDateIso, i));
    }
    return cols;
  }, [startDateIso, daysCount]);

  const windowEndIso = addDaysIso(startDateIso, daysCount);

  // Filter reservations
  const filteredReservations = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return reservations.filter((r) => {
      if (statusFilter === "active" && (r.status === "cancelled" || r.status === "no_show")) return false;
      if (statusFilter !== "active" && statusFilter !== "all" && r.status !== statusFilter) return false;
      if (propertyFilter !== "all" && r.propertyId !== propertyFilter) return false;
      if (q) {
        const guestFull = `${r.guest?.firstName ?? ""} ${r.guest?.lastName ?? ""}`.toLowerCase();
        const match =
          r.code.toLowerCase().includes(q) ||
          guestFull.includes(q) ||
          (r.guest?.email ?? "").toLowerCase().includes(q) ||
          (r.property?.name ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, propertyFilter, searchTerm]);

  // Group rooms by Property
  const groupedRooms = React.useMemo(() => {
    const propMap = new Map<string, PropertyItem>();
    for (const p of properties) propMap.set(p.id, p);

    const visibleRooms = propertyFilter === "all" ? rooms : rooms.filter((r) => r.propertyId === propertyFilter);
    const groups = new Map<string, { property: PropertyItem; rooms: Room[] }>();

    for (const r of visibleRooms) {
      const prop = propMap.get(r.propertyId) || r.property || {
        id: r.propertyId,
        name: "Property",
        code: "PROP",
        currency: "USD",
      };
      if (!groups.has(prop.id)) {
        groups.set(prop.id, { property: prop, rooms: [] });
      }
      groups.get(prop.id)!.rooms.push(r);
    }

    return Array.from(groups.values()).sort((a, b) => a.property.name.localeCompare(b.property.name));
  }, [properties, rooms, propertyFilter]);

  // Today Metrics
  const todayStats = React.useMemo(() => {
    const active = reservations.filter((r) => r.status !== "cancelled" && r.status !== "no_show");
    const checkInsToday = active.filter((r) => extractIsoDate(r.checkIn) === todayIso).length;
    const checkOutsToday = active.filter((r) => extractIsoDate(r.checkOut) === todayIso).length;
    const occupiedRoomIds = new Set<string>();
    for (const r of active) {
      const ci = extractIsoDate(r.checkIn);
      const co = extractIsoDate(r.checkOut);
      if (ci <= todayIso && todayIso < co) {
        r.rooms?.forEach((rr) => occupiedRoomIds.add(rr.roomId || rr.room.id));
      }
    }
    const totalRooms = rooms.length || 1;
    const occupancyPct = rooms.length > 0 ? Math.round((occupiedRoomIds.size / totalRooms) * 100) : 0;
    return {
      checkInsToday,
      checkOutsToday,
      occupiedCount: occupiedRoomIds.size,
      totalRooms: rooms.length,
      occupancyPct,
    };
  }, [reservations, rooms, todayIso]);

  // Drag & Drop handlers
  function handleDragStart(e: React.DragEvent, res: Reservation, sourceRoomId: string) {
    e.dataTransfer.setData("text/plain", res.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedItem({ reservationId: res.id, code: res.code, sourceRoomId });
  }

  function handleDragOver(e: React.DragEvent, roomId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetRoomId !== roomId) setDropTargetRoomId(roomId);
  }

  async function handleDrop(e: React.DragEvent, targetRoomId: string) {
    e.preventDefault();
    setDropTargetRoomId(null);
    if (!draggedItem) return;
    const { reservationId, sourceRoomId, code } = draggedItem;
    setDraggedItem(null);
    if (sourceRoomId === targetRoomId) return;

    try {
      const res = await fetch(`/api/reservations/${reservationId}/reassign-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentRoomId: sourceRoomId, targetRoomId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Room move rejected",
          description: json.error?.message ?? "Target room is unavailable on those dates.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Reservation moved", description: `Booking ${code} transferred cleanly.` });
      await load();
    } catch (err: unknown) {
      toast({ title: "Move failed", description: (err as Error)?.message, variant: "destructive" });
    }
  }

  function openQuickBookForCell(property: PropertyItem, room: Room, dateIso: string) {
    setQuickTarget({
      propertyId: property.id,
      propertyName: property.name,
      roomId: room.id,
      roomLabel: `Room ${room.number}${room.roomType?.name ? ` (${room.roomType.name})` : ""}`,
    });
    setQbCheckIn(dateIso);
    setQbCheckOut(addDaysIso(dateIso, 2));
    setQbFirstName("");
    setQbLastName("");
    setQbEmail("");
    setQbPhone("");
    setQbAdults(2);
    setQbSource("direct");
    setQbNotes("");
    setQuickBookOpen(true);
  }

  async function handleQuickBookSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: quickTarget.propertyId,
          roomIds: [quickTarget.roomId],
          checkIn: qbCheckIn,
          checkOut: qbCheckOut,
          adults: Number(qbAdults),
          source: qbSource,
          status: "confirmed",
          notes: qbNotes || undefined,
          guest: {
            firstName: qbFirstName.trim(),
            lastName: qbLastName.trim(),
            email: qbEmail.trim() || null,
            phone: qbPhone.trim() || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Booking failed", description: json.error?.message ?? "Could not create reservation", variant: "destructive" });
      } else {
        toast({ title: "Booking created", description: `Confirmed on ${quickTarget.roomLabel}` });
        setQuickBookOpen(false);
        await load();
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function handleBookingQuickStatus(booking: Reservation, nextStatus: string) {
    setActionBusy(true);
    try {
      let res: Response;
      if (nextStatus === "checked_in") {
        res = await fetch(`/api/reservations/${booking.id}/check-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idVerified: true, allowOutstandingBalance: true }),
        });
      } else if (nextStatus === "checked_out") {
        res = await fetch(`/api/reservations/${booking.id}/check-out`, { method: "POST" });
      } else if (nextStatus === "cancelled") {
        if (!window.confirm(`Cancel reservation ${booking.code}?`)) {
          setActionBusy(false);
          return;
        }
        res = await fetch(`/api/reservations/${booking.id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Cancelled from Calendar view" }),
        });
      } else {
        res = await fetch(`/api/reservations/${booking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Update failed", description: json.error?.message ?? "Could not update status", variant: "destructive" });
      } else {
        toast({ title: "Booking updated", description: `${booking.code} set to ${nextStatus.replace("_", " ")}` });
        setSelectedBooking(null);
        await load();
      }
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Range Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar & Tape Chart</h1>
          <p className="text-sm text-muted-foreground">
            Click any property, room, guest, or booking to inspect & manage. Click any empty date to book.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStartDateIso((d) => addDaysIso(d, -7))}>
            <ChevronLeft className="mr-1 h-4 w-4" strokeWidth={1.5} /> 7d
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStartDateIso(addDaysIso(todayIso, -1))}>
            <CalendarIcon className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} /> Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStartDateIso((d) => addDaysIso(d, 7))}>
            7d <ChevronRight className="ml-1 h-4 w-4" strokeWidth={1.5} />
          </Button>

          <Input
            type="date"
            aria-label="Jump to date"
            value={startDateIso}
            onChange={(e) => e.target.value && setStartDateIso(e.target.value)}
            className="h-8 w-36 text-xs"
          />

          <div className="h-6 w-px bg-border mx-0.5 hidden sm:block" />

          {[7, 14, 30].map((cnt) => (
            <Button
              key={cnt}
              variant={daysCount === cnt ? "default" : "outline"}
              size="sm"
              onClick={() => setDaysCount(cnt)}
            >
              {cnt}d
            </Button>
          ))}

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </Button>

          <Link href="/reservations/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" strokeWidth={1.5} /> New Booking
            </Button>
          </Link>
        </div>
      </div>

      {/* Today Operations Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Arrivals Today</div>
          <div className="text-xl font-bold mt-0.5">{todayStats.checkInsToday}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Departures Today</div>
          <div className="text-xl font-bold mt-0.5">{todayStats.checkOutsToday}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Today Occupancy</div>
          <div className="text-xl font-bold mt-0.5">
            {todayStats.occupiedCount}/{todayStats.totalRooms}{" "}
            <span className="text-xs font-normal text-muted-foreground">({todayStats.occupancyPct}%)</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] font-medium text-muted-foreground">Matching Bookings</div>
          <div className="text-xl font-bold mt-0.5">{filteredReservations.length}</div>
        </Card>
      </div>

      {/* Filter & Legend Bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" strokeWidth={1.5} />
            <Input
              placeholder="Search guest or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter by property"
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="all">All Properties ({properties.length})</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="active">Active Bookings</option>
            <option value="confirmed">Confirmed Only</option>
            <option value="checked_in">Checked-In Only</option>
            <option value="pending">Pending Only</option>
            <option value="all">All (Incl. Cancelled)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Confirmed</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Checked In</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-500" /> Checked Out</span>
        </div>
      </div>

      {/* Interactive Gantt Tape Chart */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(960, 224 + daysCount * 56)}px` }}>
              {/* Date Header Row */}
              <div className="sticky top-0 z-20 flex border-b bg-muted/90 backdrop-blur-sm text-xs font-semibold">
                <div className="w-56 shrink-0 p-3 border-r flex items-center justify-between">
                  <span>Property / Room</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Click to open</span>
                </div>
                <div className="flex flex-1">
                  {dateColumns.map((colIso) => {
                    const { weekday, dayNum, month } = formatDayHeader(colIso);
                    const isToday = colIso === todayIso;
                    return (
                      <div
                        key={colIso}
                        className={`flex-1 min-w-[44px] border-r py-2 px-1 text-center ${
                          isToday ? "bg-primary/15 text-primary font-bold" : ""
                        }`}
                      >
                        <div className="text-[10px] uppercase text-muted-foreground leading-none">{weekday}</div>
                        <div className="text-xs mt-1 leading-none">
                          {dayNum} <span className="text-[10px] font-normal">{month}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Loading calendar matrix...</div>
              ) : groupedRooms.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No rooms matched. Add properties/rooms or sync with Hospitable under{" "}
                  <Link href="/integrations" className="text-primary underline">Integrations</Link>.
                </div>
              ) : (
                groupedRooms.map(({ property, rooms: propRooms }) => (
                  <React.Fragment key={property.id}>
                    {/* Clickable Property Group Header */}
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs">
                      <Link
                        href={`/properties/${property.id}`}
                        className="inline-flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors"
                      >
                        <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                        <span>{property.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{property.code}</Badge>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          · {propRooms.length} room{propRooms.length === 1 ? "" : "s"} · Open Property
                        </span>
                      </Link>
                    </div>

                    {/* Room Rows */}
                    {propRooms.map((room) => {
                      const isDropTarget = dropTargetRoomId === room.id;
                      const roomBookings = filteredReservations.filter((r) => {
                        const hasRoom = r.rooms?.some((rm) => (rm.roomId || rm.room.id) === room.id);
                        if (!hasRoom) return false;
                        const ci = extractIsoDate(r.checkIn);
                        const co = extractIsoDate(r.checkOut);
                        return co > startDateIso && ci < windowEndIso;
                      });

                      return (
                        <div
                          key={room.id}
                          className={`flex border-b transition-colors hover:bg-muted/20 ${
                            isDropTarget ? "bg-primary/15 ring-1 ring-inset ring-primary" : ""
                          }`}
                          onDragOver={(e) => handleDragOver(e, room.id)}
                          onDragLeave={(e) => e.preventDefault()}
                          onDrop={(e) => void handleDrop(e, room.id)}
                        >
                          {/* Clickable Room Cell */}
                          <Link
                            href={`/rooms/${room.id}`}
                            className="w-56 shrink-0 p-2.5 border-r bg-background/60 hover:bg-muted/40 flex flex-col justify-center transition-colors group"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-xs text-foreground group-hover:text-primary flex items-center gap-1.5 truncate">
                                <BedDouble className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" strokeWidth={1.5} />
                                Room {room.number}
                              </span>
                              <Badge
                                variant={
                                  room.status === "occupied"
                                    ? "default"
                                    : room.status === "available" || room.status === "clean" || room.status === "inspected"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="text-[10px] h-5 capitalize shrink-0"
                              >
                                {room.status.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {room.roomType?.name ?? "Standard"}
                              {room.roomType?.baseRate ? ` · ${property.currency} ${Number(room.roomType.baseRate).toFixed(0)}` : ""}
                            </div>
                          </Link>

                          {/* Timeline Cells + Continuous Gantt Bars */}
                          <div className="flex flex-1 relative min-h-[60px]">
                            {dateColumns.map((colIso) => {
                              const isToday = colIso === todayIso;
                              return (
                                <button
                                  key={colIso}
                                  type="button"
                                  title={`Click to create booking on Room ${room.number} starting ${colIso}`}
                                  onClick={() => openQuickBookForCell(property, room, colIso)}
                                  className={`flex-1 min-w-[44px] border-r text-left transition-colors hover:bg-primary/10 ${
                                    isToday ? "bg-primary/5" : ""
                                  }`}
                                />
                              );
                            })}

                            {/* Layered Booking Bars */}
                            {roomBookings.map((res, idx) => {
                              const ci = extractIsoDate(res.checkIn);
                              const co = extractIsoDate(res.checkOut);
                              const clampedStart = Math.max(0, diffDaysIso(startDateIso, ci));
                              const clampedEnd = Math.min(daysCount, diffDaysIso(startDateIso, co));
                              const span = Math.max(1, clampedEnd - clampedStart);

                              const leftPct = (clampedStart / daysCount) * 100;
                              const widthPct = (span / daysCount) * 100;
                              const startsBeforeWindow = ci < startDateIso;
                              const endsAfterWindow = co > windowEndIso;

                              const guestLabel = res.guest
                                ? `${res.guest.firstName} ${res.guest.lastName}`
                                : res.code;

                              return (
                                <div
                                  key={`${res.id}-${room.id}`}
                                  draggable={res.status !== "cancelled" && res.status !== "checked_out"}
                                  onDragStart={(e) => handleDragStart(e, res, room.id)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBooking(res);
                                  }}
                                  style={{
                                    left: `calc(${leftPct}% + 2px)`,
                                    width: `calc(${widthPct}% - 4px)`,
                                    top: `${6 + (idx % 2) * 26}px`,
                                  }}
                                  title={`${res.code} · ${guestLabel} (${ci} to ${co}) — Click to open or drag to move room`}
                                  className={`absolute z-10 h-6 cursor-pointer border px-2 text-[11px] font-semibold shadow-sm transition-all flex items-center justify-between gap-1 overflow-hidden ${
                                    startsBeforeWindow ? "rounded-l-none" : "rounded-l-md"
                                  } ${endsAfterWindow ? "rounded-r-none" : "rounded-r-md"} ${bookingBarStyles(res.status)}`}
                                >
                                  <span className="flex items-center gap-1 truncate">
                                    <Move className="h-3 w-3 shrink-0 opacity-75" strokeWidth={1.5} />
                                    <span className="truncate">{guestLabel}</span>
                                    <span className="opacity-80 font-mono text-[10px] hidden sm:inline">({res.code})</span>
                                  </span>
                                  <span className="text-[10px] opacity-85 shrink-0 hidden md:inline">
                                    {res.currency} {Number(res.totalAmount).toFixed(0)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Quick-Inspect & Entity Navigation Modal */}
      <Dialog
        open={selectedBooking !== null}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
        title={selectedBooking ? `Booking ${selectedBooking.code}` : "Booking Details"}
        description={
          selectedBooking
            ? `${extractIsoDate(selectedBooking.checkIn)} to ${extractIsoDate(selectedBooking.checkOut)} · ${selectedBooking.currency} ${Number(selectedBooking.totalAmount).toFixed(2)}`
            : undefined
        }
      >
        {selectedBooking && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedBooking.status === "cancelled" ? "destructive" : "default"} className="capitalize">
                {selectedBooking.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="uppercase text-[10px]">{selectedBooking.source}</Badge>
              {selectedBooking.notes && (
                <span className="text-muted-foreground truncate max-w-xs">{selectedBooking.notes}</span>
              )}
            </div>

            {/* Direct Click-Through Cards for Every Linked Entity */}
            <div className="grid gap-2">
              {selectedBooking.property && (
                <Link
                  href={`/properties/${selectedBooking.property.id}`}
                  className="flex items-center justify-between rounded-lg border p-2.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span>
                      <span className="text-muted-foreground block text-[10px]">Property</span>
                      <span className="font-semibold text-foreground">{selectedBooking.property.name}</span>
                    </span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              )}

              {selectedBooking.guest && (
                <Link
                  href={`/guests/${selectedBooking.guest.id}`}
                  className="flex items-center justify-between rounded-lg border p-2.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span>
                      <span className="text-muted-foreground block text-[10px]">Guest Details</span>
                      <span className="font-semibold text-foreground">
                        {selectedBooking.guest.firstName} {selectedBooking.guest.lastName}
                      </span>
                      {selectedBooking.guest.email && (
                        <span className="text-muted-foreground ml-1.5">({selectedBooking.guest.email})</span>
                      )}
                    </span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              )}

              {selectedBooking.rooms?.map((rr) => (
                <Link
                  key={rr.room.id}
                  href={`/rooms/${rr.room.id}`}
                  className="flex items-center justify-between rounded-lg border p-2.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span>
                      <span className="text-muted-foreground block text-[10px]">Room</span>
                      <span className="font-semibold text-foreground">
                        Room {rr.room.number} {rr.room.roomType?.name ? `· ${rr.room.roomType.name}` : ""}
                      </span>
                    </span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>

            {/* Operational Quick Actions + Full Booking Page */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="flex flex-wrap gap-2">
                {selectedBooking.status === "pending" && (
                  <Button size="sm" disabled={actionBusy} onClick={() => void handleBookingQuickStatus(selectedBooking, "confirmed")} className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                  </Button>
                )}
                {selectedBooking.status === "confirmed" && (
                  <Button size="sm" disabled={actionBusy} onClick={() => void handleBookingQuickStatus(selectedBooking, "checked_in")} className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Check In
                  </Button>
                )}
                {selectedBooking.status === "checked_in" && (
                  <Button size="sm" disabled={actionBusy} onClick={() => void handleBookingQuickStatus(selectedBooking, "checked_out")} className="gap-1">
                    <LogOut className="h-3.5 w-3.5" /> Check Out
                  </Button>
                )}
                {(selectedBooking.status === "pending" || selectedBooking.status === "confirmed") && (
                  <Button size="sm" variant="destructive" disabled={actionBusy} onClick={() => void handleBookingQuickStatus(selectedBooking, "cancelled")} className="gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </Button>
                )}
              </div>

              <Link href={`/reservations/${selectedBooking.id}`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  Open Full Booking <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Dialog>

      {/* Quick Create Booking Modal (from clicking empty calendar cell) */}
      <Dialog
        open={quickBookOpen}
        onOpenChange={setQuickBookOpen}
        title={quickTarget ? `New Booking · ${quickTarget.roomLabel}` : "New Booking"}
        description={quickTarget?.propertyName}
      >
        <form onSubmit={handleQuickBookSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qb-ci">Check-In</Label>
              <Input id="qb-ci" type="date" required value={qbCheckIn} onChange={(e) => setQbCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qb-co">Check-Out</Label>
              <Input id="qb-co" type="date" required value={qbCheckOut} onChange={(e) => setQbCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qb-fn">Guest First Name</Label>
              <Input id="qb-fn" required value={qbFirstName} onChange={(e) => setQbFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qb-ln">Guest Last Name</Label>
              <Input id="qb-ln" required value={qbLastName} onChange={(e) => setQbLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qb-em">Email (optional)</Label>
              <Input id="qb-em" type="email" value={qbEmail} onChange={(e) => setQbEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qb-ph">Phone (optional)</Label>
              <Input id="qb-ph" value={qbPhone} onChange={(e) => setQbPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qb-ad">Adults</Label>
              <Input id="qb-ad" type="number" min={1} value={qbAdults} onChange={(e) => setQbAdults(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qb-src">Channel Source</Label>
              <select
                id="qb-src"
                value={qbSource}
                onChange={(e) => setQbSource(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                <option value="direct">Direct</option>
                <option value="phone">Phone</option>
                <option value="walk_in">Walk-in</option>
                <option value="ota">OTA</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="qb-nt">Notes (optional)</Label>
            <Input id="qb-nt" value={qbNotes} onChange={(e) => setQbNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickBookOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={actionBusy}>{actionBusy ? "Creating..." : "Confirm Booking"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
