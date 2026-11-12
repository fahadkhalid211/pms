"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Calendar,
  Building2,
  User,
  BedDouble,
  Receipt,
  CheckCircle2,
  LogOut,
  XCircle,
  Pencil,
  RefreshCw,
  ArrowRightLeft,
} from "lucide-react";

interface ReservationDetail {
  id: string;
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
  cancelledReason: string | null;
  property: { id: string; name: string; code: string; city: string | null; country: string | null; currency: string };
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
  } | null;
  rooms: Array<{
    id: string;
    roomId: string;
    nightlyRate: string | number;
    room: {
      id: string;
      number: string;
      name: string | null;
      status: string;
      roomType?: { id: string; name: string; capacity: number; baseRate: string | number };
    };
  }>;
  roomNights: Array<{
    id: string;
    date: string;
    status: string;
    price: string | number;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    total: string | number;
    currency: string;
  }>;
}

interface PropertyRoomOption {
  id: string;
  number: string;
  name: string | null;
  status: string;
  roomType?: { name: string };
}

export default function ReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const reservationId = params?.id;
  const { toast } = useToast();

  const [reservation, setReservation] = React.useState<ReservationDetail | null>(null);
  const [propertyRooms, setPropertyRooms] = React.useState<PropertyRoomOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Edit Stay Modal
  const [editOpen, setEditOpen] = React.useState(false);
  const [editCheckIn, setEditCheckIn] = React.useState("");
  const [editCheckOut, setEditCheckOut] = React.useState("");
  const [editAdults, setEditAdults] = React.useState(1);
  const [editChildren, setEditChildren] = React.useState(0);
  const [editNotes, setEditNotes] = React.useState("");

  // Reassign Room Modal
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [targetRoomId, setTargetRoomId] = React.useState("");

  const load = React.useCallback(async () => {
    if (!reservationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Reservation not found.");
        setLoading(false);
        return;
      }
      const r = json.data as ReservationDetail;
      setReservation(r);
      setEditCheckIn(new Date(r.checkIn).toISOString().slice(0, 10));
      setEditCheckOut(new Date(r.checkOut).toISOString().slice(0, 10));
      setEditAdults(r.adults);
      setEditChildren(r.children);
      setEditNotes(r.notes || "");

      if (r.property?.id) {
        const roomsRes = await fetch(`/api/rooms?propertyId=${r.property.id}`);
        const roomsJson = await roomsRes.json();
        if (roomsRes.ok && roomsJson.success) {
          setPropertyRooms(roomsJson.data ?? []);
        }
      }
    } catch {
      setError("Failed to load booking details.");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(nextStatus: string) {
    if (!reservation) return;
    setBusy(true);
    try {
      let res: Response;
      if (nextStatus === "checked_in") {
        res = await fetch(`/api/reservations/${reservation.id}/check-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idVerified: true, allowOutstandingBalance: true }),
        });
      } else if (nextStatus === "checked_out") {
        res = await fetch(`/api/reservations/${reservation.id}/check-out`, { method: "POST" });
      } else if (nextStatus === "cancelled") {
        if (!window.confirm(`Cancel reservation ${reservation.code} and release room nights?`)) {
          setBusy(false);
          return;
        }
        res = await fetch(`/api/reservations/${reservation.id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Cancelled from reservation detail view" }),
        });
      } else {
        res = await fetch(`/api/reservations/${reservation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Action failed", description: json.error?.message ?? "Could not update booking", variant: "destructive" });
      } else {
        toast({ title: "Booking updated", description: `Status set to ${nextStatus.replace("_", " ")}.` });
        await load();
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn: editCheckIn,
          checkOut: editCheckOut,
          adults: Number(editAdults),
          children: Number(editChildren),
          notes: editNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Update failed", description: json.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Booking details updated" });
        setEditOpen(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReassignRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!reservation || !reservation.rooms[0] || !targetRoomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/reassign-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRoomId: reservation.rooms[0].room.id,
          targetRoomId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Room move failed", description: json.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Room reassigned successfully" });
        setMoveOpen(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!reservation) return;
    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: reservation.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Could not create invoice", description: json.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Folio invoice generated" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading && !reservation) {
    return (
      <div className="space-y-6">
        <Link href="/calendar" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Calendar
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading booking...</CardContent></Card>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="space-y-6">
        <Link href="/reservations" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Reservations
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-destructive">{error || "Booking not found."}</CardContent></Card>
      </div>
    );
  }

  const checkInStr = new Date(reservation.checkIn).toISOString().slice(0, 10);
  const checkOutStr = new Date(reservation.checkOut).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link href="/calendar" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Calendar
            </Link>
            <span>/</span>
            <Link href="/reservations" className="hover:text-foreground">Reservations</Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{reservation.code}</h1>
            <Badge variant={reservation.status === "cancelled" ? "destructive" : "default"} className="capitalize">
              {reservation.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="uppercase text-[10px]">{reservation.source}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {checkInStr} to {checkOutStr} · {reservation.roomNights.length} night{reservation.roomNights.length === 1 ? "" : "s"} · Total {reservation.currency} {Number(reservation.totalAmount).toFixed(2)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </Button>
          {reservation.status !== "cancelled" && reservation.status !== "checked_out" && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit Stay
              </Button>
              {reservation.rooms[0] && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setTargetRoomId(reservation.rooms[0].room.id);
                    setMoveOpen(true);
                  }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Move Room
                </Button>
              )}
            </>
          )}
          {reservation.status === "pending" && (
            <Button size="sm" disabled={busy} onClick={() => void handleStatusChange("confirmed")} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
            </Button>
          )}
          {reservation.status === "confirmed" && (
            <Button size="sm" disabled={busy} onClick={() => void handleStatusChange("checked_in")} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Check In
            </Button>
          )}
          {reservation.status === "checked_in" && (
            <Button size="sm" disabled={busy} onClick={() => void handleStatusChange("checked_out")} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Check Out
            </Button>
          )}
          {(reservation.status === "pending" || reservation.status === "confirmed" || reservation.status === "draft") && (
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void handleStatusChange("cancelled")} className="gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Linked Entity Cards (all clickable) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href={`/properties/${reservation.property.id}`} className="block group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" strokeWidth={1.5} /> Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-semibold group-hover:text-primary transition-colors">{reservation.property.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {reservation.property.code} · {[reservation.property.city, reservation.property.country].filter(Boolean).join(", ") || "Open property"}
              </div>
            </CardContent>
          </Card>
        </Link>

        {reservation.guest ? (
          <Link href={`/guests/${reservation.guest.id}`} className="block group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" strokeWidth={1.5} /> Guest Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-semibold group-hover:text-primary transition-colors">
                  {reservation.guest.firstName} {reservation.guest.lastName}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {reservation.guest.email || reservation.guest.phone || "Open guest details"}
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <User className="h-4 w-4" strokeWidth={1.5} /> Guest Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Walk-in / No guest attached</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 text-primary" strokeWidth={1.5} /> Assigned Room(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {reservation.rooms.length === 0 ? (
              <span className="text-xs text-muted-foreground">No rooms assigned</span>
            ) : (
              reservation.rooms.map((rr) => (
                <Link
                  key={rr.id}
                  href={`/rooms/${rr.room.id}`}
                  className="flex items-center justify-between text-xs font-semibold hover:text-primary transition-colors"
                >
                  <span>Room {rr.room.number} {rr.room.roomType?.name ? `(${rr.room.roomType.name})` : ""}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{rr.room.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nightly Breakdown & Folios */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} /> Nightly Breakdown & Notes
            </CardTitle>
            <CardDescription className="text-xs">
              {reservation.adults} adult{reservation.adults === 1 ? "" : "s"}, {reservation.children} child{reservation.children === 1 ? "" : "ren"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {reservation.notes && (
              <div className="rounded-lg border bg-muted/30 p-3 text-foreground">{reservation.notes}</div>
            )}
            {reservation.cancelledReason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                Cancellation reason: {reservation.cancelledReason}
              </div>
            )}
            <div className="rounded-lg border divide-y">
              {reservation.roomNights.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No active RoomNight locks (booking is {reservation.status}).</div>
              ) : (
                reservation.roomNights.map((rn) => (
                  <div key={rn.id} className="flex items-center justify-between p-2.5">
                    <span className="font-mono">{new Date(rn.date).toISOString().slice(0, 10)}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{rn.status}</Badge>
                    <span className="font-semibold">{reservation.currency} {Number(rn.price).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" strokeWidth={1.5} /> Billing & Folios
              </CardTitle>
              <CardDescription className="text-xs">Linked invoices and payment statuses.</CardDescription>
            </div>
            {reservation.invoices.length === 0 && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleGenerateInvoice()} className="text-xs h-8">
                Generate Invoice
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {reservation.invoices.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No invoices generated for this reservation yet.</p>
            ) : (
              reservation.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/billing/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:border-primary/50 transition-colors"
                >
                  <div>
                    <div className="font-mono font-semibold">{inv.number}</div>
                    <div className="text-muted-foreground">Click to open folio & payments</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{inv.currency} {Number(inv.total).toFixed(2)}</span>
                    <Badge variant="outline" className="capitalize text-[10px]">{inv.status}</Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Stay Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title={`Edit Booking ${reservation.code}`}>
        <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-in">Check-In</Label>
              <Input id="ed-in" type="date" required value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-out">Check-Out</Label>
              <Input id="ed-out" type="date" required value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ed-ad">Adults</Label>
              <Input id="ed-ad" type="number" min={1} value={editAdults} onChange={(e) => setEditAdults(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ed-ch">Children</Label>
              <Input id="ed-ch" type="number" min={0} value={editChildren} onChange={(e) => setEditChildren(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-notes">Notes</Label>
            <Input id="ed-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Move Room Modal */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen} title="Reassign Room">
        <form onSubmit={handleReassignRoom} className="space-y-4 text-xs">
          <div className="space-y-1">
            <Label htmlFor="mv-room">Select Target Room</Label>
            <select
              id="mv-room"
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            >
              {propertyRooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  Room {rm.number} {rm.roomType?.name ? `(${rm.roomType.name})` : ""} — {rm.status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Moving..." : "Confirm Room Move"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
