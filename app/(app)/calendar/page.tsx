"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Move } from "lucide-react";

interface ReservationRoom {
  roomId: string;
  room: { id: string; number: string; status: string; roomType?: { name: string } };
}

interface Reservation {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  guest: { firstName: string; lastName: string } | null;
  rooms?: ReservationRoom[];
}

interface Room {
  id: string;
  number: string;
  status: string;
  roomType?: { name: string };
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = React.useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [daysCount, setDaysCount] = React.useState<number>(14);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = React.useState<{
    reservationId: string;
    code: string;
    sourceRoomId: string;
  } | null>(null);
  const [dropTargetRoomId, setDropTargetRoomId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const roomsRes = await fetch("/api/rooms");
      const roomsJson = await roomsRes.json();
      if (roomsRes.ok && roomsJson.success) {
        setRooms(roomsJson.data ?? []);
      }

      const resRes = await fetch("/api/reservations?pageSize=200");
      const resJson = await resRes.json();
      if (resRes.ok && resJson.success) {
        setReservations(resJson.data.items ?? []);
      }
    } catch (e: any) {
      toast({ title: "Failed to load calendar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Generate date columns
  const dateColumns: Date[] = React.useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [startDate, daysCount]);

  function shiftDates(deltaDays: number) {
    setStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  }

  function resetToToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
  }

  // Drag and Drop handlers
  function handleDragStart(e: React.DragEvent, res: Reservation, sourceRoomId: string) {
    e.dataTransfer.setData("text/plain", res.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedItem({
      reservationId: res.id,
      code: res.code,
      sourceRoomId,
    });
  }

  function handleDragOver(e: React.DragEvent, roomId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetRoomId !== roomId) {
      setDropTargetRoomId(roomId);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: React.DragEvent, targetRoomId: string) {
    e.preventDefault();
    setDropTargetRoomId(null);

    if (!draggedItem) return;
    const { reservationId, sourceRoomId, code } = draggedItem;
    setDraggedItem(null);

    if (sourceRoomId === targetRoomId) {
      return; // Dropped on the same room, no-op
    }

    try {
      const res = await fetch(`/api/reservations/${reservationId}/reassign-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRoomId: sourceRoomId,
          targetRoomId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Room reassignment rejected",
          description: json.error?.message ?? "Target room is not available or collision detected.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reservation reassigned",
        description: `Booking ${code} transferred to target room.`,
      });
      await load();
    } catch (err: any) {
      toast({ title: "Move error", description: err?.message, variant: "destructive" });
    }
  }

  const todayStr = toDateString(new Date());

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interactive Tape Chart & Calendar</h1>
          <p className="text-muted-foreground">
            Room matrix with drag-and-drop reservation reassignment across operational rooms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDates(-7)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> 7d
          </Button>
          <Button variant="outline" size="sm" onClick={resetToToday}>
            <CalendarIcon className="mr-1 h-4 w-4" /> Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftDates(7)}>
            7d <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <Button
            variant={daysCount === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDaysCount(7)}
          >
            7 Days
          </Button>
          <Button
            variant={daysCount === 14 ? "default" : "outline"}
            size="sm"
            onClick={() => setDaysCount(14)}
          >
            14 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Drag & Drop Help Banner */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
        <Move className="h-4 w-4 shrink-0" />
        <span>
          <strong>Pro Tip:</strong> Click and drag any reservation pill from one room row to another to execute an atomic room move.
        </span>
      </div>

      {/* Tape Chart Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Date Header Row */}
              <div className="sticky top-0 z-10 flex border-b bg-muted/80 backdrop-blur-sm text-xs font-semibold">
                <div className="w-48 shrink-0 p-3 border-r">
                  Room & Status
                </div>
                <div className="flex flex-1">
                  {dateColumns.map((colDate) => {
                    const colDateStr = toDateString(colDate);
                    const isToday = colDateStr === todayStr;
                    return (
                      <div
                        key={colDateStr}
                        className={`flex-1 border-r p-2 text-center ${
                          isToday ? "bg-primary/10 text-primary font-bold" : ""
                        }`}
                      >
                        <div className="text-[10px] uppercase text-muted-foreground">
                          {colDate.toLocaleDateString(undefined, { weekday: "short" })}
                        </div>
                        <div className="text-sm">
                          {colDate.getDate()} {colDate.toLocaleDateString(undefined, { month: "short" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Room Rows */}
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading calendar matrix…</div>
              ) : rooms.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No rooms found. Add rooms in Settings.</div>
              ) : (
                rooms.map((room) => {
                  const isDropTarget = dropTargetRoomId === room.id;

                  return (
                    <div
                      key={room.id}
                      className={`flex border-b transition-colors hover:bg-muted/30 ${
                        isDropTarget ? "bg-primary/15 border-dashed border-primary" : ""
                      }`}
                      onDragOver={(e) => handleDragOver(e, room.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => void handleDrop(e, room.id)}
                    >
                      {/* Left: Room Header */}
                      <div className="w-48 shrink-0 p-3 border-r bg-background/50 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">Room {room.number}</span>
                          <Badge
                            variant={
                              room.status === "occupied"
                                ? "default"
                                : room.status === "clean" || room.status === "inspected"
                                ? "secondary"
                                : "destructive"
                            }
                            className="text-[10px] h-5"
                          >
                            {room.status}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {room.roomType?.name ?? "Standard"}
                        </div>
                      </div>

                      {/* Right: Date Grid Cells for this room */}
                      <div className="flex flex-1 relative min-h-[58px]">
                        {dateColumns.map((colDate) => {
                          const colDateStr = toDateString(colDate);
                          const isToday = colDateStr === todayStr;

                          // Find reservations occupying this room on this date
                          const matchingReservations = reservations.filter((r) => {
                            if (r.status === "cancelled") return false;
                            const hasRoom = r.rooms?.some((rm) => rm.room.id === room.id);
                            if (!hasRoom) return false;

                            const checkInStr = toDateString(new Date(r.checkIn));
                            const checkOutStr = toDateString(new Date(r.checkOut));

                            // Active night: checkIn <= date < checkOut
                            return colDateStr >= checkInStr && colDateStr < checkOutStr;
                          });

                          return (
                            <div
                              key={colDateStr}
                              className={`flex-1 border-r p-1 flex flex-col justify-center relative ${
                                isToday ? "bg-primary/5" : ""
                              }`}
                            >
                              {matchingReservations.map((res) => {
                                const checkInStr = toDateString(new Date(res.checkIn));
                                const isFirstNight = colDateStr === checkInStr;

                                return (
                                  <div
                                    key={`${res.id}-${colDateStr}`}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, res, room.id)}
                                    className={`cursor-grab active:cursor-grabbing rounded px-1.5 py-1 text-[11px] font-medium shadow-sm transition-all hover:ring-2 hover:ring-primary ${
                                      res.status === "checked_in"
                                        ? "bg-blue-600 text-white"
                                        : "bg-emerald-600 text-white"
                                    }`}
                                    title={`${res.code} · ${res.guest?.firstName ?? "Guest"} ${res.guest?.lastName ?? ""} · Drag to reassign room`}
                                  >
                                    <div className="truncate flex items-center gap-1">
                                      <Move className="h-3 w-3 shrink-0 opacity-70" />
                                      {isFirstNight ? (
                                        <span>
                                          <strong>{res.code}</strong> {res.guest?.lastName ?? "Guest"}
                                        </span>
                                      ) : (
                                        <span className="opacity-80">· {res.code}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
