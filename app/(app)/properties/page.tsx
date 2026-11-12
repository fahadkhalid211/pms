"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { parseCsvRecords } from "@/lib/csv";
import { Building2, ChevronRight, BedDouble, Calendar, Upload, FileSpreadsheet } from "lucide-react";

interface Property {
  id: string;
  name: string;
  code: string;
  city: string | null;
  country: string | null;
  status: string;
  currency: string;
  _count?: {
    rooms: number;
    reservations: number;
  };
}

interface ParsedBulkProperty {
  name: string;
  code?: string;
  city?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  roomsCount?: number;
  baseRate?: number;
}

const SAMPLE_PROPERTIES_CSV = `name,code,city,country,currency,timezone,rooms_count,base_rate
Azure Royal Penthouse,AZURE,Miami,US,USD,America/New_York,2,320
Aspen Pine Chalet,ASPEN,Aspen,US,USD,America/Denver,1,450
Coastal Haven Studio,COAST,San Diego,US,USD,America/Los_Angeles,3,195`;

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

  // Bulk Import State
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkText, setBulkText] = React.useState("");
  const [bulkBusy, setBulkBusy] = React.useState(false);

  async function load() {
    const res = await fetch("/api/properties");
    const json = await res.json();
    if (res.ok && json.success) setProperties(json.data);
    setLoading(false);
  }

  React.useEffect(() => { void load(); }, []);

  const parsedBulkPreview: ParsedBulkProperty[] = React.useMemo(() => {
    const trimmed = bulkText.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? arr.filter((x) => x && typeof x.name === "string" && x.name.trim()) : [];
      } catch {
        return [];
      }
    }
    return parseCsvRecords(trimmed)
      .filter((r) => (r.name || r.property_name || "").trim().length > 0)
      .map((r) => ({
        name: (r.name || r.property_name).trim(),
        code: (r.code || "").trim() || undefined,
        city: (r.city || "").trim() || undefined,
        country: (r.country || "").trim() || undefined,
        currency: (r.currency || "USD").trim(),
        timezone: (r.timezone || "UTC").trim(),
        roomsCount: Number.parseInt(r.rooms_count || r.rooms || "1", 10) || 1,
        baseRate: Number.parseFloat(r.base_rate || r.rate || "150") || 150,
      }));
  }, [bulkText]);

  function handleCsvFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setBulkText(reader.result);
    };
    reader.readAsText(file);
  }

  async function handleBulkImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedBulkPreview.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/properties/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: parsedBulkPreview }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ title: "Bulk import failed", description: json.error?.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Bulk properties imported",
        description: `Imported ${json.data.imported} propert${json.data.imported === 1 ? "y" : "ies"}${json.data.skippedCount ? ` (${json.data.skippedCount} skipped)` : ""}.`,
      });
      setBulkOpen(false);
      setBulkText("");
      await load();
    } catch {
      toast({ title: "Network error", description: "Failed to import properties.", variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">Manage properties and click any listing to open its details, rooms, bookings, and team.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5 self-start sm:self-auto">
          <Upload className="h-4 w-4" strokeWidth={1.5} />
          Bulk Import Properties
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Existing properties ({properties.length})</CardTitle>
            <CardDescription className="text-xs">Select a property to inspect bookings, rooms, rate plans, and sync feeds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties yet. Create your first property or bulk import via CSV.</p>
            ) : (
              properties.map((p) => (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}`}
                  className="group flex items-center justify-between rounded-lg border p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {p.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.code} · {p.city ?? "—"}, {p.country ?? "—"} · {p.currency}
                      </div>
                      {p._count && (
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <BedDouble className="h-3 w-3" strokeWidth={1.5} />
                            {p._count.rooms} room{p._count.rooms === 1 ? "" : "s"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" strokeWidth={1.5} />
                            {p._count.reservations} booking{p._count.reservations === 1 ? "" : "s"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge variant={p.status === "active" ? "default" : "muted"} className="capitalize">
                      {p.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                  </div>
                </Link>
              ))
            )}
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
                <div className="space-y-2"><Label htmlFor="pctin">Check-in (hr)</Label><Input id="pctin" type="number" min={0} max={23} value={checkInTime} onChange={(e) => setCheckInTime(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="pctout">Check-out (hr)</Label><Input id="pctout" type="number" min={0} max={23} value={checkOutTime} onChange={(e) => setCheckOutTime(Number(e.target.value))} /></div>
                <div className="space-y-2"><Label htmlFor="ptax">Tax %</Label><Input id="ptax" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
              </div>
              {error ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
              <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create property"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Import Properties Modal */}
      <Dialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk Import Properties"
        description="Upload a CSV file or paste CSV / JSON rows. Each property also initializes default rooms automatically."
      >
        <form onSubmit={handleBulkImportSubmit} className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 font-medium hover:bg-muted/40">
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
              <span>Upload CSV File</span>
              <input type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleCsvFileUpload} />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setBulkText(SAMPLE_PROPERTIES_CSV)}
            >
              Load Sample CSV
            </Button>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bulk-props-text">CSV (headers: name,code,city,country,currency,timezone,rooms_count,base_rate) or JSON</Label>
            <textarea
              id="bulk-props-text"
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={SAMPLE_PROPERTIES_CSV}
              className="w-full rounded-md border border-input bg-background p-2.5 font-mono text-[11px]"
            />
          </div>

          {parsedBulkPreview.length > 0 && (
            <div className="rounded-md border max-h-36 overflow-y-auto">
              <div className="bg-muted/40 px-2.5 py-1.5 font-semibold border-b">
                Preview: {parsedBulkPreview.length} propert{parsedBulkPreview.length === 1 ? "y" : "ies"} ready to import
              </div>
              <div className="divide-y">
                {parsedBulkPreview.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="px-2.5 py-1.5 flex items-center justify-between">
                    <span className="font-medium">{item.name} {item.code ? `(${item.code})` : ""}</span>
                    <span className="text-muted-foreground">
                      {[item.city, item.country].filter(Boolean).join(", ") || "—"} · {item.roomsCount ?? 1} room(s) · {item.currency ?? "USD"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={bulkBusy || parsedBulkPreview.length === 0}>
              {bulkBusy ? "Importing..." : `Import ${parsedBulkPreview.length || ""} Properties`}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
