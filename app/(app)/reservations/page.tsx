"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, Alert } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface ReservationRow {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  source: string;
  property: { name: string } | null;
  guest: { firstName: string; lastName: string; email: string } | null;
}

const STATUS_BADGE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "muted"> = {
  pending: "secondary",
  confirmed: "default",
  checked_in: "default",
  checked_out: "muted",
  cancelled: "destructive",
  no_show: "destructive",
};

export default function ReservationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = React.useState<ReservationRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ReservationRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query) params.set("query", query);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await fetch(`/api/reservations?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to load reservations");
      setLoading(false);
      return;
    }
    setItems(json.data.items);
    setTotal(json.data.total);
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query, page]);

  async function updateStatus(id: string, newStatus: string) {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast({ title: "Update failed", description: json.error?.message ?? "Could not update reservation", variant: "destructive" });
      return;
    }
    toast({ title: "Reservation updated", description: `Status set to ${newStatus}.` });
    setSelected(null);
    await load();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground">Create, search, and manage bookings.</p>
        </div>
        <Button variant="outline" size="sm">
          <Link href="/reservations/new" className="inline-flex items-center justify-center">New reservation</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input placeholder="Search booking code or guest…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="sm:max-w-sm" />
            <select className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked in</option>
              <option value="checked_out">Checked out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
            <Button variant="outline" onClick={() => void load()}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error ? <div className="p-4"><Alert variant="destructive">{error}</Alert></div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium">Booking</th>
                  <th className="p-3 text-left font-medium">Guest</th>
                  <th className="p-3 text-left font-medium">Check-in</th>
                  <th className="p-3 text-left font-medium">Check-out</th>
                  <th className="p-3 text-left font-medium">Guests</th>
                  <th className="p-3 text-left font-medium">Source</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No reservations found.</td></tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3 font-medium">{r.code}</td>
                      <td className="p-3">{r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "—"}</td>
                      <td className="p-3">{new Date(r.checkIn).toDateString()}</td>
                      <td className="p-3">{new Date(r.checkOut).toDateString()}</td>
                      <td className="p-3">{r.adults + r.children}</td>
                      <td className="p-3 capitalize">{r.source}</td>
                      <td className="p-3"><Badge variant={STATUS_BADGE_VARIANTS[r.status] ?? "muted"}>{r.status.replace(/_/g, " ")}</Badge></td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>Manage</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
            <div>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)} title="Reservation details" description={selected?.code}>
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Status</div><div>{selected.status}</div>
              <div>Check-in</div><div>{new Date(selected.checkIn).toDateString()}</div>
              <div>Check-out</div><div>{new Date(selected.checkOut).toDateString()}</div>
              <div>Guests</div><div>{selected.adults + selected.children}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === "pending" && (
                <Button size="sm" onClick={() => void updateStatus(selected.id, "confirmed")}>Confirm</Button>
              )}
              {selected.status === "confirmed" && (
                <Button size="sm" onClick={() => void updateStatus(selected.id, "checked_in")}>Check in</Button>
              )}
              {selected.status === "checked_in" && (
                <Button size="sm" onClick={() => void updateStatus(selected.id, "checked_out")}>Check out</Button>
              )}
              {(selected.status === "pending" || selected.status === "confirmed") && (
                <Button size="sm" variant="destructive" onClick={() => void updateStatus(selected.id, "cancelled")}>Cancel</Button>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
