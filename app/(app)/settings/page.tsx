"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface Property {
  id: string;
  name: string;
  code: string;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  checkInTime: number;
  checkOutTime: number;
  taxRate: string | number;
  cleaningFee: string | number;
  description: string | null;
  status: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form states
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [timezone, setTimezone] = React.useState("UTC");
  const [checkInTime, setCheckInTime] = React.useState(15);
  const [checkOutTime, setCheckOutTime] = React.useState(11);
  const [taxRate, setTaxRate] = React.useState("0");
  const [cleaningFee, setCleaningFee] = React.useState("0");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [city, setCity] = React.useState("");
  const [country, setCountry] = React.useState("");

  const loadProperties = React.useCallback(async () => {
    try {
      const res = await fetch("/api/properties");
      const json = await res.json();
      if (res.ok && json.success) {
        setProperties(json.data);
        if (json.data.length > 0 && !selectedPropertyId) {
          const first = json.data[0];
          setSelectedPropertyId(first.id);
          populateForm(first);
        }
      }
    } catch {
      setError("Failed to load property settings.");
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  function populateForm(prop: Property) {
    setName(prop.name || "");
    setCode(prop.code || "PROP");
    setCurrency(prop.currency || "USD");
    setTimezone(prop.timezone || "UTC");
    setCheckInTime(prop.checkInTime ?? 15);
    setCheckOutTime(prop.checkOutTime ?? 11);
    setTaxRate(String(prop.taxRate ?? "0"));
    setCleaningFee(String(prop.cleaningFee ?? "0"));
    setPhone(prop.phone || "");
    setEmail(prop.email || "");
    setCity(prop.city || "");
    setCountry(prop.country || "");
  }

  React.useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  function onSelectProperty(id: string) {
    setSelectedPropertyId(id);
    const found = properties.find((p) => p.id === id);
    if (found) populateForm(found);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPropertyId) return;

    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/properties/${selectedPropertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          currency,
          timezone,
          checkInTime: Number(checkInTime),
          checkOutTime: Number(checkOutTime),
          taxRate: Number(taxRate),
          cleaningFee: Number(cleaningFee),
          phone: phone || null,
          email: email || null,
          city: city || null,
          country: country || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Failed to save settings");
      }

      toast({ title: "Settings saved successfully" });
      await loadProperties();
    } catch (err: any) {
      setError(err.message ?? "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading property configurations…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Property & Operations Settings</h1>
          <p className="text-muted-foreground">
            Configure financial rules, local timezones, daily operational check-in/out policies, and taxes.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/onboarding"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Launch Setup Wizard
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      {properties.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Properties Configured</CardTitle>
            <CardDescription>
              Create your initial property in the Properties module or run the Onboarding Setup Wizard.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <form onSubmit={onSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Property to Configure</CardTitle>
              <CardDescription>Each location manages independent operating parameters and tax rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-2">
                <Label>Active Property</Label>
                <Select value={selectedPropertyId} onChange={(e) => onSelectProperty(e.target.value)}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) — {p.city ?? "No City"}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>General & Regional</CardTitle>
                <CardDescription>Location identity and standard localization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Property Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Short Code</Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Base Currency</Label>
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="JPY">JPY (¥)</option>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="UTC">UTC (Universal)</option>
                    <option value="America/New_York">America/New_York (Eastern)</option>
                    <option value="America/Chicago">America/Chicago (Central)</option>
                    <option value="America/Denver">America/Denver (Mountain)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Operations & Turnaround</CardTitle>
                <CardDescription>Standard guest arrival, departure, and housekeeping turnover windows.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Check-In Hour (24h)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(parseInt(e.target.value, 10) || 15)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Standard 15 = 3:00 PM</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Check-Out Hour (24h)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(parseInt(e.target.value, 10) || 11)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Standard 11 = 11:00 AM</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Front Desk Email</Label>
                    <Input
                      type="email"
                      placeholder="frontdesk@property.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Financial & Tax Engine Rules</CardTitle>
                <CardDescription>
                  Automated charges computed during reservation pricing and server-side invoicing.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Municipal & State Tax Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Applied to accommodation and cleaning subtotal.</p>
                </div>
                <div className="space-y-2">
                  <Label>Standard Cleaning / Turnover Fee ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cleaningFee}
                    onChange={(e) => setCleaningFee(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Fixed one-time turnover fee per reservation.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving Changes…" : "Save Property Settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
