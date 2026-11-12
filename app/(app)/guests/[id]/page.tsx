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
import { ArrowLeft, User, Mail, Phone, Calendar, Building2, Pencil, RefreshCw, ChevronRight } from "lucide-react";

interface GuestDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  profile?: {
    loyaltyTier: string | null;
    totalStays: number;
    totalSpent: string | number;
    preferences?: Record<string, unknown> | null;
  } | null;
  reservations: Array<{
    id: string;
    code: string;
    status: string;
    source: string;
    checkIn: string;
    checkOut: string;
    totalAmount: string | number;
    currency: string;
    property: { id: string; name: string; code: string; currency: string };
    rooms: Array<{ room: { id: string; number: string; name: string | null } }>;
  }>;
}

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const guestId = params?.id;
  const { toast } = useToast();

  const [guest, setGuest] = React.useState<GuestDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formState, setFormState] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });

  const load = React.useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guests/${guestId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Guest not found.");
      } else {
        const g = json.data as GuestDetail;
        setGuest(g);
        setFormState({
          firstName: g.firstName || "",
          lastName: g.lastName || "",
          email: g.email || "",
          phone: g.phone || "",
          notes: g.notes || "",
        });
      }
    } catch {
      setError("Failed to load guest details.");
    } finally {
      setLoading(false);
    }
  }, [guestId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!guest) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Update failed", description: json.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Guest profile updated" });
        setEditOpen(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading && !guest) {
    return (
      <div className="space-y-6">
        <Link href="/guests" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Guests
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading guest profile...</CardContent></Card>
      </div>
    );
  }

  if (error || !guest) {
    return (
      <div className="space-y-6">
        <Link href="/guests" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Guests
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-destructive">{error || "Guest not found."}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/guests" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Guests
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
              {(guest.firstName?.[0] || "") + (guest.lastName?.[0] || "")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{guest.firstName} {guest.lastName}</h1>
                {guest.profile?.loyaltyTier && (
                  <Badge variant="secondary" className="capitalize text-xs">{guest.profile.loyaltyTier}</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {guest.email || "No email"}</span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {guest.phone || "No phone"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit Guest
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" strokeWidth={1.5} /> Profile & Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Reservations</span>
              <span className="font-semibold">{guest.reservations.length}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Loyalty Tier</span>
              <span className="font-semibold capitalize">{guest.profile?.loyaltyTier || "Standard"}</span>
            </div>
            {guest.notes && (
              <div>
                <div className="text-muted-foreground mb-1">Notes</div>
                <p className="rounded-md bg-muted/40 p-2.5 text-foreground">{guest.notes}</p>
              </div>
            )}
            {guest.profile?.preferences && (
              <div>
                <div className="text-muted-foreground mb-1">Imported / Channel Details</div>
                <pre className="rounded-md bg-muted/40 p-2.5 text-[11px] overflow-x-auto">
                  {JSON.stringify(guest.profile.preferences, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} /> Bookings ({guest.reservations.length})
            </CardTitle>
            <CardDescription className="text-xs">Click any booking or property to open its full details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {guest.reservations.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No bookings recorded for this guest yet.</p>
            ) : (
              guest.reservations.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 hover:border-primary/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/reservations/${r.id}`} className="font-mono font-bold text-primary hover:underline">
                        {r.code}
                      </Link>
                      <Badge variant={r.status === "cancelled" ? "destructive" : "default"} className="capitalize text-[10px]">
                        {r.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="uppercase text-[10px]">{r.source}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span>{new Date(r.checkIn).toISOString().slice(0, 10)} → {new Date(r.checkOut).toISOString().slice(0, 10)}</span>
                      <Link href={`/properties/${r.property.id}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Building2 className="h-3 w-3" /> {r.property.name}
                      </Link>
                      {r.rooms[0]?.room && (
                        <Link href={`/rooms/${r.rooms[0].room.id}`} className="hover:text-primary">
                          Room {r.rooms[0].room.number}
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
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Guest Details">
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eg-fn">First Name</Label>
              <Input id="eg-fn" required value={formState.firstName} onChange={(e) => setFormState({ ...formState, firstName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eg-ln">Last Name</Label>
              <Input id="eg-ln" required value={formState.lastName} onChange={(e) => setFormState({ ...formState, lastName: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="eg-em">Email</Label>
            <Input id="eg-em" type="email" value={formState.email} onChange={(e) => setFormState({ ...formState, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eg-ph">Phone</Label>
            <Input id="eg-ph" value={formState.phone} onChange={(e) => setFormState({ ...formState, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eg-nt">Notes</Label>
            <Input id="eg-nt" value={formState.notes} onChange={(e) => setFormState({ ...formState, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
