"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, LogIn, LogOut, RefreshCw, ArrowRightLeft, Sparkles, AlertTriangle } from "lucide-react";

interface ReservationRoom {
  room: { id: string; number: string; status: string; roomType?: { name: string } };
}

interface Reservation {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: string | number;
  guest: { id?: string; firstName: string; lastName: string; email?: string } | null;
  rooms?: ReservationRoom[];
  invoices?: Array<{ id: string; total: number; status: string; payments: Array<{ amount: number; status: string }> }>;
}

interface Room {
  id: string;
  number: string;
  status: string;
  floor?: string | null;
  roomType?: { name: string };
}

export default function FrontDeskPage() {
  const { toast } = useToast();
  const [arrivals, setArrivals] = React.useState<Reservation[]>([]);
  const [departures, setDepartures] = React.useState<Reservation[]>([]);
  const [inHouse, setInHouse] = React.useState<Reservation[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [outstanding, setOutstanding] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  // Check-in modal state
  const [checkInModal, setCheckInModal] = React.useState<Reservation | null>(null);
  const [idVerified, setIdVerified] = React.useState(true);
  const [idDocType, setIdDocType] = React.useState("passport");
  const [idDocNumber, setIdDocNumber] = React.useState("");
  const [allowBalanceOverride, setAllowBalanceOverride] = React.useState(false);
  const [checkInNotes, setCheckInNotes] = React.useState("");
  const [checkInPending, setCheckInPending] = React.useState(false);

  // Checkout modal state
  const [checkOutModal, setCheckOutModal] = React.useState<Reservation | null>(null);
  const [forceCheckout, setForceCheckout] = React.useState(false);
  const [checkOutNotes, setCheckOutNotes] = React.useState("");
  const [checkOutPending, setCheckOutPending] = React.useState(false);

  // Room move modal state
  const [moveModal, setMoveModal] = React.useState<Reservation | null>(null);
  const [currentRoomId, setCurrentRoomId] = React.useState("");
  const [targetRoomId, setTargetRoomId] = React.useState("");
  const [movePending, setMovePending] = React.useState(false);

  const todayKey = new Date().toDateString();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reservations?pageSize=200");
      const json = await res.json();
      if (res.ok && json.success) {
        const all: Reservation[] = json.data.items ?? [];
        setArrivals(all.filter((r) => r.status === "confirmed" && new Date(r.checkIn).toDateString() <= todayKey));
        setDepartures(all.filter((r) => r.status === "checked_in" && new Date(r.checkOut).toDateString() <= todayKey));
        setInHouse(all.filter((r) => r.status === "checked_in"));
      }

      const roomsRes = await fetch("/api/rooms");
      const roomsJson = await roomsRes.json();
      if (roomsRes.ok && roomsJson.success) {
        setRooms(roomsJson.data ?? []);
      }

      const invRes = await fetch("/api/invoices");
      const invJson = await invRes.json();
      if (invRes.ok && invJson.success) {
        const open = (invJson.data?.invoices ?? []).filter((i: { status: string }) => ["issued", "overdue"].includes(i.status));
        setOutstanding(open.reduce((acc: number, i: { total: number }) => acc + Number(i.total ?? 0), 0));
      }
    } catch (e: any) {
      toast({ title: "Failed to load front desk data", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [todayKey, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Execute Check-in
  async function handleCheckInSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkInModal) return;

    setCheckInPending(true);
    try {
      const res = await fetch(`/api/reservations/${checkInModal.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idVerified,
          idDocumentDetails: idDocNumber ? { type: idDocType, number: idDocNumber } : undefined,
          allowOutstandingBalance: allowBalanceOverride,
          notes: checkInNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Check-in blocked",
          description: json.error?.message ?? "Check-in verification failed.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Guest checked in",
        description: `Reservation ${checkInModal.code} is now active in room(s).`,
      });
      setCheckInModal(null);
      await load();
    } catch (err: any) {
      toast({ title: "Check-in failed", description: err?.message, variant: "destructive" });
    } finally {
      setCheckInPending(false);
    }
  }

  // Execute Check-out
  async function handleCheckOutSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkOutModal) return;

    setCheckOutPending(true);
    try {
      const res = await fetch(`/api/reservations/${checkOutModal.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forceUnsettled: forceCheckout,
          notes: checkOutNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Checkout blocked",
          description: json.error?.message ?? "Checkout failed.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Guest checked out",
        description: `Room(s) marked dirty. Turnover housekeeping task automatically created.`,
      });
      setCheckOutModal(null);
      await load();
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err?.message, variant: "destructive" });
    } finally {
      setCheckOutPending(false);
    }
  }

  // Execute Room Move
  async function handleRoomMoveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moveModal || !currentRoomId || !targetRoomId) return;

    setMovePending(true);
    try {
      const res = await fetch(`/api/reservations/${moveModal.id}/reassign-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRoomId,
          targetRoomId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Room move failed",
          description: json.error?.message ?? "Unable to transfer rooms.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Room moved successfully",
        description: `Transferred reservation ${moveModal.code} to new room. Turnover dispatched for old room.`,
      });
      setMoveModal(null);
      await load();
    } catch (err: any) {
      toast({ title: "Room move error", description: err?.message, variant: "destructive" });
    } finally {
      setMovePending(false);
    }
  }

  // Quick Room Status change
  async function handleQuickStatusChange(roomId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Status update failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({ title: `Room updated to ${newStatus}` });
      await load();
    } catch (err: any) {
      toast({ title: "Error updating room", description: err?.message, variant: "destructive" });
    }
  }

  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const cleanRooms = rooms.filter((r) => r.status === "clean" || r.status === "inspected").length;
  const dirtyRooms = rooms.filter((r) => r.status === "dirty").length;
  const outOfServiceRooms = rooms.filter((r) => r.status === "out_of_service").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Front Desk Operations</h1>
          <p className="text-muted-foreground">Manage arrivals, departures, room assignments, and housekeeping readiness.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Arrivals Today</div>
            <div className="text-2xl font-bold text-primary">{arrivals.length}</div>
            <div className="text-xs text-muted-foreground">Awaiting check-in</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Departures Today</div>
            <div className="text-2xl font-bold text-amber-600">{departures.length}</div>
            <div className="text-xs text-muted-foreground">Pending checkout</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Occupied Rooms</div>
            <div className="text-2xl font-bold">{occupiedRooms} <span className="text-sm font-normal text-muted-foreground">/ {rooms.length}</span></div>
            <div className="text-xs text-muted-foreground">{rooms.length ? `${Math.round((occupiedRooms / rooms.length) * 100)}% occupancy` : "0%"} · {inHouse.length} in-house</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Room Readiness</div>
            <div className="text-2xl font-bold text-emerald-600">{cleanRooms} Clean</div>
            <div className="text-xs text-muted-foreground">{dirtyRooms} dirty · {outOfServiceRooms} out-of-order</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Outstanding Balances</div>
            <div className="text-2xl font-bold text-rose-600">${outstanding.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Unsettled guest folios</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Arrivals Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-primary" />
                  Expected Arrivals ({arrivals.length})
                </CardTitle>
                <CardDescription>Verified ID and room cleanliness required for check-in.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading arrivals…</p>
            ) : arrivals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending arrivals today.</p>
            ) : (
              arrivals.map((r) => {
                const roomInfo = r.rooms?.[0]?.room;
                const isClean = roomInfo ? (roomInfo.status === "clean" || roomInfo.status === "inspected" || roomInfo.status === "available") : false;

                return (
                  <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">
                        {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Walk-in Guest"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.code} · Room {roomInfo?.number ?? "Unassigned"} ({roomInfo?.roomType?.name ?? "Room"})
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={isClean ? "default" : "destructive"}>
                          {roomInfo ? `Room ${roomInfo.status}` : "No Room"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {r.adults} adult{r.adults > 1 ? "s" : ""} · {r.children} child{r.children !== 1 ? "ren" : ""}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCheckInModal(r);
                        setIdVerified(true);
                        setIdDocNumber("");
                        setAllowBalanceOverride(false);
                        setCheckInNotes("");
                      }}
                    >
                      <ShieldCheck className="mr-1.5 h-4 w-4" />
                      Check in
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Departures Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LogOut className="h-5 w-5 text-amber-600" />
                  Expected Departures ({departures.length})
                </CardTitle>
                <CardDescription>Checkout automatically creates turnover cleaning tasks.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading departures…</p>
            ) : departures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departures due today.</p>
            ) : (
              departures.map((r) => {
                const roomInfo = r.rooms?.[0]?.room;
                return (
                  <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">
                        {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Guest"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.code} · Room {roomInfo?.number ?? "—"}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        Total folio: ${Number(r.totalAmount || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMoveModal(r);
                          setCurrentRoomId(r.rooms?.[0]?.room?.id ?? "");
                          setTargetRoomId("");
                        }}
                      >
                        <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                        Move Room
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setCheckOutModal(r);
                          setForceCheckout(false);
                          setCheckOutNotes("");
                        }}
                      >
                        Check out
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* In-House Guests & Room Rack */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Room Status & Inventory Rack</CardTitle>
              <CardDescription>Real-time room occupancy, cleaning state, and maintenance status.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {rooms.map((room) => {
              const statusColor =
                room.status === "occupied"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                  : room.status === "clean" || room.status === "inspected"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : room.status === "dirty"
                  ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
                  : room.status === "out_of_service"
                  ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20"
                  : "border-border";

              return (
                <div key={room.id} className={`flex flex-col justify-between rounded-lg border-2 p-3 ${statusColor}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">Room {room.number}</span>
                      <Badge
                        variant={
                          room.status === "occupied"
                            ? "default"
                            : room.status === "clean" || room.status === "inspected"
                            ? "default"
                            : room.status === "dirty"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {room.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {room.roomType?.name ?? "Standard"} {room.floor ? `· Floor ${room.floor}` : ""}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1 border-t pt-2">
                    {room.status === "dirty" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void handleQuickStatusChange(room.id, "clean")}
                      >
                        <Sparkles className="mr-1 h-3 w-3" /> Clean
                      </Button>
                    )}
                    {room.status === "clean" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void handleQuickStatusChange(room.id, "inspected")}
                      >
                        Inspect
                      </Button>
                    )}
                    {room.status !== "occupied" && room.status !== "out_of_service" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-rose-600"
                        onClick={() => void handleQuickStatusChange(room.id, "out_of_service")}
                      >
                        Out of order
                      </Button>
                    )}
                    {room.status === "out_of_service" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-emerald-600"
                        onClick={() => void handleQuickStatusChange(room.id, "clean")}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Check-In Dialog */}
      <Dialog
        open={Boolean(checkInModal)}
        onOpenChange={(open) => !open && setCheckInModal(null)}
        title={`Check In — Reservation ${checkInModal?.code ?? ""}`}
        description="Verify guest identity and balance before issuing room keys."
      >
        {checkInModal && (
          <form className="space-y-4" onSubmit={handleCheckInSubmit}>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="font-semibold">
                {checkInModal.guest ? `${checkInModal.guest.firstName} ${checkInModal.guest.lastName}` : "Walk-in Guest"}
              </div>
              <div className="text-muted-foreground">
                Stay: {new Date(checkInModal.checkIn).toLocaleDateString()} to {new Date(checkInModal.checkOut).toLocaleDateString()}
              </div>
              <div className="mt-1 font-medium">
                Room: {checkInModal.rooms?.[0]?.room?.number ?? "Unassigned"} ({checkInModal.rooms?.[0]?.room?.status ?? ""})
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="font-medium text-sm flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Guest Identity Verification (Mandatory)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="idVerifiedCheckbox"
                  checked={idVerified}
                  onChange={(e) => setIdVerified(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="idVerifiedCheckbox" className="text-sm font-normal">
                  Government photo ID inspected and verified
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <Label htmlFor="docType" className="text-xs">Document Type</Label>
                  <Select id="docType" value={idDocType} onChange={(e) => setIdDocType(e.target.value)}>
                    <option value="passport">Passport</option>
                    <option value="driver_license">Driver&apos;s License</option>
                    <option value="national_id">National ID Card</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="docNum" className="text-xs">Document Number</Label>
                  <Input
                    id="docNum"
                    placeholder="e.g. A12345678"
                    value={idDocNumber}
                    onChange={(e) => setIdDocNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="font-medium text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Financial Balance Policy
              </div>
              <div className="text-xs text-muted-foreground">
                Total Reservation Rate: ${Number(checkInModal.totalAmount || 0).toFixed(2)}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="overrideBalance"
                  checked={allowBalanceOverride}
                  onChange={(e) => setAllowBalanceOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <Label htmlFor="overrideBalance" className="text-sm font-normal text-muted-foreground">
                  Allow check-in with open balance (Manager Override)
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cinNotes">Check-in Notes</Label>
              <Input
                id="cinNotes"
                placeholder="Keycard number, special requests..."
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCheckInModal(null)}>Cancel</Button>
              <Button type="submit" disabled={checkInPending || !idVerified}>
                {checkInPending ? "Checking in…" : "Confirm Check In"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog
        open={Boolean(checkOutModal)}
        onOpenChange={(open) => !open && setCheckOutModal(null)}
        title={`Check Out — Reservation ${checkOutModal?.code ?? ""}`}
        description="Confirm departure and initiate automatic housekeeping turnover."
      >
        {checkOutModal && (
          <form className="space-y-4" onSubmit={handleCheckOutSubmit}>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="font-semibold">
                {checkOutModal.guest ? `${checkOutModal.guest.firstName} ${checkOutModal.guest.lastName}` : "Guest"}
              </div>
              <div className="text-muted-foreground">
                Room(s): {checkOutModal.rooms?.map((r) => r.room.number).join(", ") ?? "—"}
              </div>
              <div className="mt-1 font-medium text-amber-600">
                Notice: Vacated room(s) will automatically be flagged dirty with turnover cleaning tasks.
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceCheckoutCheckbox"
                  checked={forceCheckout}
                  onChange={(e) => setForceCheckout(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <Label htmlFor="forceCheckoutCheckbox" className="text-sm font-normal">
                  Force checkout even if folio has pending charges or balances
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coutNotes">Checkout Notes</Label>
              <Input
                id="coutNotes"
                placeholder="Minibar inspected, keys returned..."
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCheckOutModal(null)}>Cancel</Button>
              <Button type="submit" variant="default" disabled={checkOutPending}>
                {checkOutPending ? "Processing…" : "Complete Check Out"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Room Move Dialog */}
      <Dialog
        open={Boolean(moveModal)}
        onOpenChange={(open) => !open && setMoveModal(null)}
        title={`Room Move / Reassignment — ${moveModal?.code ?? ""}`}
        description="Transfer this reservation to another clean and available room."
      >
        {moveModal && (
          <form className="space-y-4" onSubmit={handleRoomMoveSubmit}>
            <div className="space-y-2">
              <Label>Current Room</Label>
              <Select value={currentRoomId} onChange={(e) => setCurrentRoomId(e.target.value)}>
                {moveModal.rooms?.map((r) => (
                  <option key={r.room.id} value={r.room.id}>
                    Room {r.room.number} ({r.room.status})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Room</Label>
              <Select value={targetRoomId} onChange={(e) => setTargetRoomId(e.target.value)}>
                <option value="">Select clean target room…</option>
                {rooms
                  .filter((r) => r.id !== currentRoomId && (r.status === "clean" || r.status === "available" || r.status === "inspected"))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.number} ({r.roomType?.name ?? "Standard"} - {r.status})
                    </option>
                  ))}
              </Select>
            </div>

            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Inventory night rows will be moved atomically. The previous room will be marked dirty with an automated turnover task.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMoveModal(null)}>Cancel</Button>
              <Button type="submit" disabled={movePending || !targetRoomId}>
                {movePending ? "Transferring…" : "Execute Room Move"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
