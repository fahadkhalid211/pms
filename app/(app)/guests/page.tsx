"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  _count?: { reservations: number };
}

export default function GuestsPage() {
  const { toast } = useToast();
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [query, setQuery] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    const res = await fetch(`/api/guests?${params.toString()}`);
    const json = await res.json();
    if (res.ok && json.success) setGuests(json.data);
  }

  React.useEffect(() => { void load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, phone }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) { setError(json.error?.message ?? "Failed to create guest"); return; }
    toast({ title: "Guest created" });
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Guests</h1>
        <p className="text-muted-foreground">Guest profiles and reservation history.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input placeholder="Search guests…" value={query} onChange={(e) => { setQuery(e.target.value); void load(); }} className="sm:max-w-sm" />
              <Button variant="outline" onClick={() => void load()}>Search</Button>
            </div>
          </CardContent>
          <CardContent className="space-y-2">
            {guests.length === 0 ? <p className="text-sm text-muted-foreground">No guests found.</p> : guests.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{g.firstName} {g.lastName}</div>
                  <div className="text-sm text-muted-foreground">{g.email ?? "—"} · {g._count?.reservations ?? 0} reservations</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Add guest</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="gfn">First name</Label><Input id="gfn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="gln">Last name</Label><Input id="gln" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="gem">Email</Label><Input id="gem" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="gph">Phone</Label><Input id="gph" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              {error ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
              <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add guest"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
