"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  roomType: { id: string; name: string; capacity: number; baseRate: number };
}

export default function NewReservationPage() {
  const { toast } = useToast();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [propertyId, setPropertyId] = React.useState("");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const [selectedRooms, setSelectedRooms] = React.useState<string[]>([]);
  const [guestId, setGuestId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/properties");
      const json = await res.json();
      if (res.ok && json.success) {
        setProperties(json.data);
        if (json.data[0]) setPropertyId(json.data[0].id);
      }
    })();
  }, []);

  React.useEffect(() => {
    void (async () => {
      if (!propertyId) return;
      const res = await fetch(`/api/rooms?propertyId=${propertyId}`);
      const json = await res.json();
      if (res.ok && json.success) setRooms(json.data);
    })();
  }, [propertyId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, roomIds: selectedRooms, checkIn, checkOut, adults, children, guestId: guestId || null, source: "direct", status: "confirmed" }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to create reservation");
      return;
    }
    toast({ title: "Reservation created", description: `Booking ${json.data.reservation.code} confirmed.` });
    window.location.href = "/reservations";
  }

  const nights = checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New reservation</h1>
        <p className="text-muted-foreground">Search availability and confirm a booking.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Booking details</CardTitle><CardDescription>Dates and guest count.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select id="property" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setSelectedRooms([]); }}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest">Guest</Label>
              <Input id="guest" placeholder="Link an existing guest (optional)" value={guestId} onChange={(e) => setGuestId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkIn">Check-in</Label>
              <Input id="checkIn" type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setSelectedRooms([]); }} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Check-out</Label>
              <Input id="checkOut" type="date" value={checkOut} onChange={(e) => { setCheckOut(e.target.value); setSelectedRooms([]); }} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adults">Adults</Label>
              <Input id="adults" type="number" min={1} max={12} value={adults} onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="children">Children</Label>
              <Input id="children" type="number" min={0} max={12} value={children} onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)} />
            </div>
            {error ? <div className="sm:col-span-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
              <Button type="submit" disabled={pending || nights <= 0 || selectedRooms.length === 0}>
                {pending ? "Creating…" : "Create reservation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Select rooms</CardTitle><CardDescription>Available rooms for the selected dates.</CardDescription></CardHeader>
        <CardContent>
          {!checkIn || !checkOut ? (
            <p className="text-sm text-muted-foreground">Select check-in and check-out dates to see availability.</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms found for this property.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rooms.map((room) => (
                <label key={room.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span>
                    Room {room.number} · {room.roomType.name} · sleeps {room.roomType.capacity}
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={selectedRooms.includes(room.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRooms((prev) => [...prev, room.id]);
                      else setSelectedRooms((prev) => prev.filter((id) => id !== room.id));
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
