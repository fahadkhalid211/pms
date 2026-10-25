"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Property {
  id: string;
  name: string;
  code: string;
  city: string | null;
  country: string | null;
  status: string;
  currency: string;
}

export default function PropertiesPage() {
  const { toast } = useToast();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [timezone, setTimezone] = React.useState("UTC");
  const [checkInTime, setCheckInTime] = React.useState(15);
  const [checkOutTime, setCheckOutTime] = React.useState(11);
  const [taxRate, setTaxRate] = React.useState(0);
  const [cleaningFee, setCleaningFee] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function load() {
    const res = await fetch("/api/properties");
    const json = await res.json();
    if (res.ok && json.success) setProperties(json.data);
    setLoading(false);
  }

  React.useEffect(() => { void load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, city, country, currency, timezone, checkInTime, checkOutTime, taxRate, cleaningFee }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok || !json.success) {
      setError(json.error?.message ?? "Failed to create property");
      return;
    }
    toast({ title: "Property created" });
    setName(""); setCity(""); setCountry(""); setTaxRate(0); setCleaningFee(0);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
        <p className="text-muted-foreground">Manage the properties within your organization.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Existing properties</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : properties.length === 0 ? <p className="text-sm text-muted-foreground">No properties yet. Create your first property.</p> : properties.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.code} · {p.city ?? "—"}, {p.country ?? "—"}</div>
                </div>
                <Badge variant={p.status === "active" ? "default" : "muted"}>{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Create property</CardTitle><CardDescription>Set up a new location.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="space-y-2"><Label htmlFor="pname">Name</Label><Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="pcode">Code</Label><Input id="pcode" value={code} onChange={(e) => setCode(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="pcurrency">Currency</Label><Input id="pcurrency" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="pcity">City</Label><Input id="pcity" value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="pcountry">Country</Label><Input id="pcountry" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="pctz">Timezone</Label><Input id="pctz" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="pctin">Check-in (min)</Label><Input id="pctin" type="number" value={checkInTime} onChange={(e) => setCheckInTime(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="pctout">Check-out (min)</Label><Input id="pctout" type="number" value={checkOutTime} onChange={(e) => setCheckOutTime(Number(e.target.value))} /></div>
                <div className="space-y-2"><Label htmlFor="ptax">Tax %</Label><Input id="ptax" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
              </div>
              {error ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create property"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
