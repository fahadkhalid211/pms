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
import { formatRoomDisplayName } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Calendar,
  BedDouble,
  DollarSign,
  Users,
  Wrench,
  Sparkles,
  MapPin,
  Clock,
  Mail,
  Phone,
  Globe,
  RefreshCw,
  Pencil,
  Plus,
  Check,
  Copy,
} from "lucide-react";

interface PropertyDetail {
  id: string;
  name: string;
  code: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  checkInTime: number;
  checkOutTime: number;
  taxRate: string | number;
  cleaningFee: string | number;
  description: string | null;
  status: "active" | "inactive" | "archived";
  roomTypes: Array<{
    id: string;
    name: string;
    capacity: number;
    baseRate: string | number;
    bedType: string | null;
  }>;
  rooms: Array<{
    id: string;
    number: string;
    name: string | null;
    floor: string | null;
    status: string;
    roomType?: { id: string; name: string; baseRate: string | number; capacity: number };
  }>;
  ratePlans: Array<{
    id: string;
    name: string;
    type: string;
    amount: string | number;
    currency: string;
    isActive: boolean;
  }>;
  reservations: Array<{
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
    guest?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
    } | null;
    rooms?: Array<{
      room?: { id: string; number: string; name: string | null };
    }>;
  }>;
  memberships: Array<{
    id: string;
    isAdmin: boolean;
    status: string;
    user: { id: string; name: string; email: string; roleKey: string | null; status: string };
  }>;
  integrations: Array<{
    id: string;
    provider: string;
    name: string;
    status: string;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
  housekeepingTasks: Array<{
    id: string;
    title: string | null;
    status: string;
    priority: string;
    dueAt: string | null;
    room?: { id: string; number: string };
  }>;
  maintenanceTickets: Array<{
    id: string;
    description: string;
    status: string;
    priority: string;
    room?: { id: string; number: string } | null;
  }>;
  metrics: {
    totalBookings: number;
    upcomingBookings: number;
    checkedInNow: number;
    totalRooms: number;
    totalRevenue: string;
    openHousekeeping: number;
    openMaintenance: number;
  };
}

type TabKey = "overview" | "bookings" | "rooms" | "operations";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const propertyId = params?.id;
  const { toast } = useToast();

  const [property, setProperty] = React.useState<PropertyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<TabKey>("bookings");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [copiedIcal, setCopiedIcal] = React.useState(false);

  // Edit Dialog State
  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formState, setFormState] = React.useState({
    name: "",
    code: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    timezone: "UTC",
    currency: "USD",
    checkInTime: 15,
    checkOutTime: 11,
    taxRate: 0,
    cleaningFee: 0,
    description: "",
    status: "active" as "active" | "inactive" | "archived",
  });

  const loadProperty = React.useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to load property details");
      } else {
        const p = json.data as PropertyDetail;
        setProperty(p);
        setFormState({
          name: p.name || "",
          code: p.code || "",
          addressLine1: p.addressLine1 || "",
          city: p.city || "",
          state: p.state || "",
          postalCode: p.postalCode || "",
          country: p.country || "",
          phone: p.phone || "",
          email: p.email || "",
          timezone: p.timezone || "UTC",
          currency: p.currency || "USD",
          checkInTime: p.checkInTime ?? 15,
          checkOutTime: p.checkOutTime ?? 11,
          taxRate: Number(p.taxRate ?? 0),
          cleaningFee: Number(p.cleaningFee ?? 0),
          description: p.description || "",
          status: p.status || "active",
        });
      }
    } catch {
      setError("Network error while loading property.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  React.useEffect(() => {
    void loadProperty();
  }, [loadProperty]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          checkInTime: Number(formState.checkInTime),
          checkOutTime: Number(formState.checkOutTime),
          taxRate: Number(formState.taxRate),
          cleaningFee: Number(formState.cleaningFee),
          addressLine1: formState.addressLine1 || null,
          city: formState.city || null,
          state: formState.state || null,
          postalCode: formState.postalCode || null,
          country: formState.country || null,
          phone: formState.phone || null,
          email: formState.email || null,
          description: formState.description || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Property updated" });
        setEditOpen(false);
        void loadProperty();
      } else {
        toast({ title: "Update failed", description: json.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Failed to save property details.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !property) {
    return (
      <div className="space-y-6">
        <Link href="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to Properties
        </Link>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading property details...</CardContent></Card>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="space-y-6">
        <Link href="/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to Properties
        </Link>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-destructive font-medium">{error || "Property not found."}</p>
            <Button variant="outline" size="sm" onClick={() => void loadProperty()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const icalUrl = `${origin}/api/integrations/ical/${property.id}`;
  const locationParts = [property.addressLine1, property.city, property.state, property.postalCode, property.country].filter(Boolean);

  const filteredBookings = property.reservations.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const guestName = `${r.guest?.firstName ?? ""} ${r.guest?.lastName ?? ""}`.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      guestName.includes(q) ||
      (r.guest?.email ?? "").toLowerCase().includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q)
    );
  });

  function formatHour(h: number): string {
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:00 ${suffix}`;
  }

  function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    if (status === "confirmed" || status === "checked_in" || status === "active") return "default";
    if (status === "cancelled" || status === "no_show") return "destructive";
    if (status === "pending") return "secondary";
    return "outline";
  }

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/properties" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to All Properties
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
                <Badge variant="outline" className="font-mono text-xs">{property.code}</Badge>
                <Badge variant={statusBadgeVariant(property.status)} className="capitalize text-xs">{property.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {locationParts.length > 0 ? locationParts.join(", ") : "Address not specified"}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {property.timezone} · {property.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadProperty()} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" strokeWidth={1.5} />
            Edit Property
          </Button>
          <Link href="/reservations/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              New Booking
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.metrics.totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.metrics.upcomingBookings} upcoming · {property.metrics.checkedInNow} checked in
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Rooms & Units</CardTitle>
            <BedDouble className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.metrics.totalRooms}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.roomTypes.length} room type{property.roomTypes.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Booked Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {property.currency} {Number(property.metrics.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Excludes cancelled stays</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Operations & Team</CardTitle>
            <Users className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{property.memberships.length} Staff</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.metrics.openHousekeeping} housekeeping · {property.metrics.openMaintenance} maintenance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <Button
          size="sm"
          variant={activeTab === "bookings" ? "default" : "outline"}
          onClick={() => setActiveTab("bookings")}
          className="gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
          Bookings ({property.reservations.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "overview" ? "default" : "outline"}
          onClick={() => setActiveTab("overview")}
          className="gap-1.5"
        >
          <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          Property Details & Channels
        </Button>
        <Button
          size="sm"
          variant={activeTab === "rooms" ? "default" : "outline"}
          onClick={() => setActiveTab("rooms")}
          className="gap-1.5"
        >
          <BedDouble className="h-3.5 w-3.5" strokeWidth={1.5} />
          Rooms & Rates ({property.rooms.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "operations" ? "default" : "outline"}
          onClick={() => setActiveTab("operations")}
          className="gap-1.5"
        >
          <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />
          Team & Operations
        </Button>
      </div>

      {/* TAB 1: Bookings */}
      {activeTab === "bookings" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Property Bookings & Guests</CardTitle>
              <CardDescription className="text-xs">
                All reservations imported from Hospitable, direct portal, and manual front-desk entries.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search code, guest, channel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-52 text-xs"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredBookings.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No bookings found for this property matching the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="p-3 font-semibold">Code</th>
                      <th className="p-3 font-semibold">Guest Details</th>
                      <th className="p-3 font-semibold">Dates</th>
                      <th className="p-3 font-semibold">Room(s)</th>
                      <th className="p-3 font-semibold">Source</th>
                      <th className="p-3 font-semibold">Total</th>
                      <th className="p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBookings.map((r) => {
                      const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Walk-in / Unassigned";
                      return (
                        <tr key={r.id} className="hover:bg-muted/20">
                          <td className="p-3 font-mono font-semibold text-foreground">
                            <Link href={`/reservations/${r.id}`} className="text-primary hover:underline">
                              {r.code}
                            </Link>
                          </td>
                          <td className="p-3">
                            {r.guest ? (
                              <Link href={`/guests/${r.guest.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                                {guestName}
                              </Link>
                            ) : (
                              <div className="font-medium text-foreground">{guestName}</div>
                            )}
                            <div className="text-[11px] text-muted-foreground">
                              {r.guest?.email || r.guest?.phone || `${r.adults} adults`}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div>{new Date(r.checkIn).toISOString().slice(0, 10)} → {new Date(r.checkOut).toISOString().slice(0, 10)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {r.adults} adult{r.adults === 1 ? "" : "s"}{r.children > 0 ? `, ${r.children} children` : ""}
                            </div>
                          </td>
                          <td className="p-3 font-medium">
                            {r.rooms && r.rooms.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {r.rooms.map((rr, idx) =>
                                  rr.room ? (
                                    <Link key={rr.room.id || idx} href={`/rooms/${rr.room.id}`} className="text-primary hover:underline">
                                      {formatRoomDisplayName(rr.room)}
                                    </Link>
                                  ) : null,
                                )}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] uppercase">{r.source}</Badge>
                            {r.notes && <div className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={r.notes}>{r.notes}</div>}
                          </td>
                          <td className="p-3 font-semibold whitespace-nowrap">
                            {r.currency} {Number(r.totalAmount).toFixed(2)}
                          </td>
                          <td className="p-3">
                            <Badge variant={statusBadgeVariant(r.status)} className="capitalize text-[10px]">
                              {r.status.replace("_", " ")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Property Details & Channels */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property Profile & Policies</CardTitle>
              <CardDescription className="text-xs">Location, check-in/out schedule, and billing defaults.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 border-b pb-3">
                <div>
                  <div className="text-muted-foreground">Check-In Time</div>
                  <div className="font-semibold flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> {formatHour(property.checkInTime)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Check-Out Time</div>
                  <div className="font-semibold flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> {formatHour(property.checkOutTime)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tax Rate</div>
                  <div className="font-semibold mt-0.5">{Number(property.taxRate).toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cleaning Fee</div>
                  <div className="font-semibold mt-0.5">{property.currency} {Number(property.cleaningFee).toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2 border-b pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{property.email || "No property contact email set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{property.phone || "No phone number set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{locationParts.length > 0 ? locationParts.join(", ") : "No street address set"}</span>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground mb-1">Description</div>
                <p className="text-foreground leading-relaxed">
                  {property.description || "No description added yet."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Channels & iCal Feed</CardTitle>
              <CardDescription className="text-xs">Sync feeds and channel links attached to this property.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="font-semibold text-foreground">Live iCal Export Feed</div>
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2.5">
                  <span className="font-mono text-[11px] break-all">{icalUrl}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs shrink-0 gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(icalUrl);
                      setCopiedIcal(true);
                      setTimeout(() => setCopiedIcal(false), 2000);
                    }}
                  >
                    {copiedIcal ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedIcal ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Active Integrations</span>
                  <Link href="/integrations" className="text-primary hover:underline font-medium">Manage Channels</Link>
                </div>
                {property.integrations.length === 0 ? (
                  <p className="text-muted-foreground">No channels connected for this property yet.</p>
                ) : (
                  <div className="space-y-2">
                    {property.integrations.map((intg) => (
                      <div key={intg.id} className="flex items-center justify-between rounded-lg border p-2.5">
                        <div>
                          <div className="font-semibold">{intg.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {intg.provider}{intg.lastSyncAt ? ` · Synced ${new Date(intg.lastSyncAt).toLocaleString()}` : ""}
                          </div>
                        </div>
                        <Badge variant={intg.status === "connected" ? "default" : "secondary"} className="text-[10px]">
                          {intg.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Rooms & Rate Plans */}
      {activeTab === "rooms" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Rooms & Units ({property.rooms.length})</CardTitle>
                <CardDescription className="text-xs">Physical units tracked in availability & housekeeping.</CardDescription>
              </div>
              <Link href="/rooms"><Button size="sm" variant="outline" className="text-xs h-8">Manage Rooms</Button></Link>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {property.rooms.length === 0 ? (
                <p className="text-muted-foreground">No rooms configured yet.</p>
              ) : (
                property.rooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-foreground hover:text-primary">
                        {formatRoomDisplayName(room)}
                      </div>
                      <div className="text-muted-foreground">
                        {room.roomType?.name || "Standard"} · Cap {room.roomType?.capacity ?? 2} · {property.currency} {Number(room.roomType?.baseRate ?? 0).toFixed(2)}/night
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{room.status.replace(/_/g, " ")}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Room Types & Rate Plans</CardTitle>
              <CardDescription className="text-xs">Pricing tiers configured for this property.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Room Types</div>
                {property.roomTypes.length === 0 ? (
                  <p className="text-muted-foreground">No room types defined.</p>
                ) : (
                  property.roomTypes.map((rt) => (
                    <div key={rt.id} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div>
                        <div className="font-semibold">{rt.name}</div>
                        <div className="text-muted-foreground">Max guests: {rt.capacity}</div>
                      </div>
                      <span className="font-semibold">{property.currency} {Number(rt.baseRate).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Rate Plans</div>
                {property.ratePlans.length === 0 ? (
                  <p className="text-muted-foreground">Using room type base rates (no custom rate plans).</p>
                ) : (
                  property.ratePlans.map((rp) => (
                    <div key={rp.id} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div>
                        <div className="font-semibold">{rp.name}</div>
                        <div className="text-muted-foreground capitalize">{rp.type}</div>
                      </div>
                      <Badge variant={rp.isActive ? "default" : "secondary"} className="text-[10px]">
                        {rp.currency} {Number(rp.amount).toFixed(2)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: Team & Operations */}
      {activeTab === "operations" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Assigned Staff & Owners
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {property.memberships.length === 0 ? (
                <p className="text-muted-foreground">Accessible to all org admins. No property-specific team members assigned.</p>
              ) : (
                property.memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <div className="font-semibold">{m.user.name}</div>
                      <div className="text-muted-foreground">{m.user.email}</div>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{m.user.roleKey || "member"}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Housekeeping Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {property.housekeepingTasks.length === 0 ? (
                <p className="text-muted-foreground">No housekeeping tasks logged for this property.</p>
              ) : (
                property.housekeepingTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <div className="font-semibold">{t.title || `Room ${t.room?.number || "—"} turnover`}</div>
                      <div className="text-muted-foreground">Room {t.room?.number || "—"} · Priority: {t.priority}</div>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{t.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" /> Maintenance Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {property.maintenanceTickets.length === 0 ? (
                <p className="text-muted-foreground">No maintenance tickets logged for this property.</p>
              ) : (
                property.maintenanceTickets.map((mt) => (
                  <div key={mt.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <div className="font-semibold line-clamp-1">{mt.description}</div>
                      <div className="text-muted-foreground">Room {mt.room?.number || "General"} · {mt.priority}</div>
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">{mt.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Property Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Edit ${property.name}`}
        description="Update location, contact info, policies, or active status."
      >
        <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ep-name">Name</Label>
              <Input id="ep-name" required value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-code">Code</Label>
              <Input id="ep-code" required value={formState.code} onChange={(e) => setFormState({ ...formState, code: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ep-addr">Street Address</Label>
            <Input id="ep-addr" value={formState.addressLine1} onChange={(e) => setFormState({ ...formState, addressLine1: e.target.value })} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ep-city">City</Label>
              <Input id="ep-city" value={formState.city} onChange={(e) => setFormState({ ...formState, city: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-state">State</Label>
              <Input id="ep-state" value={formState.state} onChange={(e) => setFormState({ ...formState, state: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-country">Country</Label>
              <Input id="ep-country" value={formState.country} onChange={(e) => setFormState({ ...formState, country: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ep-email">Contact Email</Label>
              <Input id="ep-email" type="email" value={formState.email} onChange={(e) => setFormState({ ...formState, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-phone">Phone</Label>
              <Input id="ep-phone" value={formState.phone} onChange={(e) => setFormState({ ...formState, phone: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ep-currency">Currency</Label>
              <Input id="ep-currency" value={formState.currency} onChange={(e) => setFormState({ ...formState, currency: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-tax">Tax %</Label>
              <Input id="ep-tax" type="number" step="0.01" value={formState.taxRate} onChange={(e) => setFormState({ ...formState, taxRate: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-in">Check-in Hr</Label>
              <Input id="ep-in" type="number" min={0} max={23} value={formState.checkInTime} onChange={(e) => setFormState({ ...formState, checkInTime: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-out">Check-out Hr</Label>
              <Input id="ep-out" type="number" min={0} max={23} value={formState.checkOutTime} onChange={(e) => setFormState({ ...formState, checkOutTime: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ep-status">Status</Label>
            <select
              id="ep-status"
              value={formState.status}
              onChange={(e) => setFormState({ ...formState, status: e.target.value as "active" | "inactive" | "archived" })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
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
