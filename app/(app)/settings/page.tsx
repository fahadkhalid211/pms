"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Palette,
  Building2,
  UploadCloud,
  Check,
  Trash2,
  Eye,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { BRANDING_COLOR_PRESETS, hexToHsl } from "@/lib/branding";

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
  const [activeTab, setActiveTab] = React.useState<"branding" | "properties">("branding");

  // --- Branding State ---
  const [brandName, setBrandName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [primaryColor, setPrimaryColor] = React.useState("#000000");
  const [accentColor, setAccentColor] = React.useState("#ffffff");
  const [loadingBranding, setLoadingBranding] = React.useState(true);
  const [savingBranding, setSavingBranding] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // --- Property State ---
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [loadingProperties, setLoadingProperties] = React.useState(true);
  const [savingProperty, setSavingProperty] = React.useState(false);
  const [propertyError, setPropertyError] = React.useState<string | null>(null);

  // Property Form states
  const [propName, setPropName] = React.useState("");
  const [propCode, setPropCode] = React.useState("");
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

  // Load Branding Data
  const loadBranding = React.useCallback(async () => {
    setLoadingBranding(true);
    try {
      const res = await fetch("/api/organization/branding");
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const b = json.data;
        setBrandName(b.name || "");
        setLogoUrl(b.logoUrl || "");
        setPrimaryColor(b.primaryColor || "#000000");
        setAccentColor(b.accentColor || "#ffffff");
        setTagline(b.branding?.tagline || "");
      }
    } catch {
      // silent
    } finally {
      setLoadingBranding(false);
    }
  }, []);

  // Load Properties
  const loadProperties = React.useCallback(async () => {
    try {
      const res = await fetch("/api/properties");
      const json = await res.json();
      if (res.ok && json.success) {
        setProperties(json.data);
        if (json.data.length > 0 && !selectedPropertyId) {
          const first = json.data[0];
          setSelectedPropertyId(first.id);
          populatePropertyForm(first);
        }
      }
    } catch {
      setPropertyError("Failed to load property settings.");
    } finally {
      setLoadingProperties(false);
    }
  }, [selectedPropertyId]);

  function populatePropertyForm(prop: Property) {
    setPropName(prop.name || "");
    setPropCode(prop.code || "PROP");
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
    void loadBranding();
    void loadProperties();
  }, [loadBranding, loadProperties]);

  function onSelectProperty(id: string) {
    setSelectedPropertyId(id);
    const found = properties.find((p) => p.id === id);
    if (found) populatePropertyForm(found);
  }

  // Handle Logo Upload
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to upload logo image");
      }

      setLogoUrl(json.data.urlPath);
      toast({
        title: "Logo uploaded",
        description: "Click 'Save Changes' to apply your new branding.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // Save Branding
  async function onSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavingBranding(true);

    try {
      const res = await fetch("/api/organization/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brandName,
          logoUrl: logoUrl || null,
          primaryColor,
          accentColor,
          branding: {
            tagline,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save branding");
      }

      toast({
        title: "Branding updated successfully",
        description: "Your custom logo and color theme are now active.",
      });

      // Dispatch event for instant real-time update in AppShell
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("lumina:branding-updated", { detail: json.data }),
        );
      }
    } catch (err: any) {
      toast({
        title: "Failed to save branding",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingBranding(false);
    }
  }

  // Save Property Settings
  async function onSaveProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPropertyId) return;

    setPropertyError(null);
    setSavingProperty(true);

    try {
      const res = await fetch(`/api/properties/${selectedPropertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: propName,
          code: propCode,
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

      toast({ title: "Property settings saved successfully" });
      await loadProperties();
    } catch (err: any) {
      setPropertyError(err.message ?? "An error occurred");
    } finally {
      setSavingProperty(false);
    }
  }

  const primaryHsl = hexToHsl(primaryColor);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Settings & Customization
            </h1>
            <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
              Organization
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure your brand identity, custom logo, theme colors, and operating parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Launch Setup Wizard
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex rounded-lg border border-border bg-card p-1 text-xs font-medium w-fit gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
            activeTab === "branding"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          Organization Logo & Branding
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("properties")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
            activeTab === "properties"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Property & Operations
        </button>
      </div>

      {/* TAB 1: Organization & Branding */}
      {activeTab === "branding" && (
        <div className="space-y-6">
          <form onSubmit={onSaveBranding} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Form Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Brand Identity Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-primary" />
                      Brand Identity
                    </CardTitle>
                    <CardDescription>
                      The display name and identity shown across the PMS, client reports, and guest interfaces.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="brandName">Organization / Brand Name</Label>
                      <Input
                        id="brandName"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g. The Penthouse Living"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tagline">Tagline or Subtitle (Optional)</Label>
                      <Input
                        id="tagline"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="e.g. Luxury Serviced Apartments in London & Paris"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Shown beneath your brand name in the sidebar navigation and report exports.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Logo Upload Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <UploadCloud className="h-4 w-4 text-primary" />
                      Brand Logo
                    </CardTitle>
                    <CardDescription>
                      Upload an official logo image or provide an external image URL. Supported formats: PNG, JPG, SVG, WebP.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* File upload input hidden */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-lg border border-border bg-muted/20">
                      {/* Logo Preview Box */}
                      <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-card p-1 overflow-hidden">
                        {logoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-[10px] text-muted-foreground">
                            No Logo
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="gap-1.5 text-xs h-8"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          {uploadingLogo ? "Uploading..." : "Upload Logo Image"}
                        </Button>

                        {logoUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogoUrl("")}
                            className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="logoUrl" className="text-xs text-muted-foreground">
                        Or enter direct image URL:
                      </Label>
                      <Input
                        id="logoUrl"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png or /api/uploads/..."
                        className="text-xs font-mono"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Color Selection Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      Branding Colors & Palette
                    </CardTitle>
                    <CardDescription>
                      Select an curated luxury hospitality palette or customize exact HEX values.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Preset Themes Grid */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Curated Luxury Presets</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {BRANDING_COLOR_PRESETS.map((preset) => {
                          const isSelected =
                            primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                            accentColor.toLowerCase() === preset.accent.toLowerCase();

                          return (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => {
                                setPrimaryColor(preset.primary);
                                setAccentColor(preset.accent);
                              }}
                              className={`flex flex-col text-left p-2.5 rounded-lg border text-xs transition ${
                                isSelected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border bg-card hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-foreground text-[11px] truncate">
                                  {preset.name}
                                </span>
                                {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="h-4 w-4 rounded-full border border-black/10 shadow-2xs"
                                  style={{ backgroundColor: preset.primary }}
                                  title={`Primary: ${preset.primary}`}
                                />
                                <div
                                  className="h-4 w-4 rounded-full border border-black/10 shadow-2xs"
                                  style={{ backgroundColor: preset.accent }}
                                  title={`Accent: ${preset.accent}`}
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {preset.primary}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Color Pickers */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                      {/* Primary Color */}
                      <div className="space-y-2">
                        <Label htmlFor="primaryColor" className="text-xs font-medium">
                          Primary Brand Color
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="primaryColorPicker"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="h-9 w-10 cursor-pointer rounded border border-input p-0.5 bg-background"
                          />
                          <Input
                            id="primaryColor"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            placeholder="#0f172a"
                            className="font-mono text-xs uppercase"
                            pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Used for main navigation highlights, primary buttons, and focal elements.
                        </p>
                      </div>

                      {/* Accent Color */}
                      <div className="space-y-2">
                        <Label htmlFor="accentColor" className="text-xs font-medium">
                          Secondary / Accent Color
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="accentColorPicker"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="h-9 w-10 cursor-pointer rounded border border-input p-0.5 bg-background"
                          />
                          <Input
                            id="accentColor"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            placeholder="#3b82f6"
                            className="font-mono text-xs uppercase"
                            pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Used for badges, status indicators, and subtle decorative borders.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={savingBranding || loadingBranding}
                    className="gap-2 px-6 font-semibold"
                  >
                    {savingBranding ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving Branding...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Save Branding Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Right Column: Live Real-Time Interactive Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="sticky top-6 border-2 border-primary/20 bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4 text-primary" />
                        Live Theme Preview
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Instant Preview
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Simulated preview of how your brand identity renders inside Lumina PMS.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Mock Sidebar Header */}
                    <div className="rounded-lg border border-border bg-card p-3 shadow-2xs space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sidebar Navigation Brand Header
                      </span>
                      <div className="flex items-center gap-2.5 p-2 rounded-md bg-muted/40 border border-border">
                        {logoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="h-8 max-w-[100px] object-contain rounded"
                          />
                        ) : (
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-sm shadow-xs"
                            style={{
                              backgroundColor: primaryColor,
                              color: primaryHsl.foreground === "0 0% 100%" ? "#ffffff" : "#0f172a",
                            }}
                          >
                            {(brandName || "L").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate">
                          <div className="text-xs font-bold truncate text-foreground">
                            {brandName || "The Penthouse Living"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {tagline || "Luxury Serviced Apartments"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mock UI Elements (Buttons & Badges) */}
                    <div className="rounded-lg border border-border bg-card p-3 shadow-2xs space-y-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Primary & Accent Components
                      </span>

                      {/* Button Samples */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-muted-foreground">Primary Action Buttons:</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs transition"
                            style={{
                              backgroundColor: primaryColor,
                              color: primaryHsl.foreground === "0 0% 100%" ? "#ffffff" : "#0f172a",
                            }}
                          >
                            New Reservation
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-md text-xs font-semibold border transition"
                            style={{
                              borderColor: primaryColor,
                              color: primaryColor,
                              backgroundColor: "transparent",
                            }}
                          >
                            Export Client Report
                          </button>
                        </div>
                      </div>

                      {/* Accent Badges */}
                      <div className="space-y-1.5 pt-2 border-t">
                        <div className="text-[11px] text-muted-foreground">Status & Metric Badges:</div>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                            style={{
                              backgroundColor: `${accentColor}18`,
                              color: accentColor,
                              borderColor: `${accentColor}40`,
                            }}
                          >
                            Confirmed VIP Stay
                          </span>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
                            style={{
                              backgroundColor: `${primaryColor}15`,
                              color: primaryColor,
                              borderColor: `${primaryColor}35`,
                            }}
                          >
                            Penthouse Suite
                          </span>
                        </div>
                      </div>

                      {/* Mock Metric Card */}
                      <div className="p-3 rounded-md border border-border bg-muted/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Portfolio Realization</span>
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: accentColor }}
                          >
                            84.7%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: "84.7%", backgroundColor: primaryColor }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
                      Saving your branding applies your logo and color scheme to all sidebars, top headers, PDF folios, and client reporting views.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Property & Operations */}
      {activeTab === "properties" && (
        <div className="space-y-6">
          {propertyError ? (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {propertyError}
            </div>
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
            <form onSubmit={onSaveProperty} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select Property to Configure</CardTitle>
                  <CardDescription>
                    Each location manages independent operating parameters and tax rules.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-w-md space-y-2">
                    <Label>Active Property</Label>
                    <Select
                      value={selectedPropertyId}
                      onChange={(e) => onSelectProperty(e.target.value)}
                    >
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
                      <Label htmlFor="propName">Property Display Name</Label>
                      <Input
                        id="propName"
                        value={propName}
                        onChange={(e) => setPropName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="propCode">Property Short Code</Label>
                      <Input
                        id="propCode"
                        value={propCode}
                        onChange={(e) => setPropCode(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency Code</Label>
                        <Select
                          id="currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                        >
                          <option value="GBP">GBP (£)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="USD">USD ($)</option>
                          <option value="AED">AED (AED)</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select
                          id="timezone"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                        >
                          <option value="Europe/London">Europe/London</option>
                          <option value="Europe/Paris">Europe/Paris</option>
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="Asia/Dubai">Asia/Dubai</option>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. London"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="e.g. United Kingdom"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Operational Times & Taxes</CardTitle>
                    <CardDescription>
                      Check-in/out schedules and transaction line fees.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="checkIn">Standard Check-In (24h)</Label>
                        <Input
                          id="checkIn"
                          type="number"
                          min={0}
                          max={23}
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkOut">Standard Check-Out (24h)</Label>
                        <Input
                          id="checkOut"
                          type="number"
                          min={0}
                          max={23}
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="taxRate">City Tax Rate (%)</Label>
                        <Input
                          id="taxRate"
                          type="number"
                          step="0.01"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cleaningFee">Fixed Cleaning Fee</Label>
                        <Input
                          id="cleaningFee"
                          type="number"
                          step="0.01"
                          value={cleaningFee}
                          onChange={(e) => setCleaningFee(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Contact Telephone</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Reservations Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingProperty || loadingProperties} className="gap-2">
                  {savingProperty ? "Saving..." : loadingProperties ? "Loading Properties..." : "Save Property Operations"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
