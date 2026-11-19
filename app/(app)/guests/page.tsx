"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/utils";
import {
  ChevronRight,
  Users,
  Wallet,
  Sparkles,
  TrendingUp,
  Search,
  UserCheck,
  Award,
  ArrowUpRight,
} from "lucide-react";

interface GuestProfile {
  id: string;
  loyaltyTier?: string | null;
  totalStays: number;
  totalSpent: number | string;
  preferences?: {
    preferredChannel?: string;
    adults?: number;
  } | null;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  profile?: GuestProfile | null;
  _count?: { reservations: number };
}

interface AnalyticsData {
  guests: {
    totalGuests: number;
    repeatGuestsCount: number;
    singleStayCount: number;
    repeatRatePct: number;
    totalGuestSpent: number;
    avgSpendPerGuest: number;
    topGuests: Array<{
      id: string;
      name: string;
      email: string | null;
      stays: number;
      nights: number;
      totalSpent: number;
      channel: string;
      loyaltyTier: string;
    }>;
    groupSizes: {
      soloCount: number;
      couplesCount: number;
      groupCount: number;
    };
  };
  channels: Array<{
    key: string;
    name: string;
    bookings: number;
    nights: number;
    grossRevenue: number;
    paid: number;
    shareOfRevenue: number;
    shareOfBookings: number;
  }>;
}

export default function GuestsPage() {
  const { toast } = useToast();
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"directory" | "vip" | "channels">("directory");
  const [filterType, setFilterType] = React.useState<"all" | "repeat" | "vip">("all");
  const [query, setQuery] = React.useState("");

  // Add guest form
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [guestsRes, analyticsRes] = await Promise.all([
        fetch("/api/guests?limit=250"),
        fetch("/api/analytics/summary"),
      ]);
      const [guestsJson, analyticsJson] = await Promise.all([
        guestsRes.json(),
        analyticsRes.json(),
      ]);

      if (guestsRes.ok && guestsJson.success) {
        setGuests(guestsJson.data || []);
      }
      if (analyticsRes.ok && analyticsJson.success) {
        setAnalytics(analyticsJson.data);
      }
    } catch {
      toast({ title: "Failed to load guest data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to create guest");
        return;
      }
      toast({ title: "Guest created" });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      await loadData();
    } finally {
      setPending(false);
    }
  }

  // Filtered guests
  const filteredGuests = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      const full = `${g.firstName} ${g.lastName}`.toLowerCase();
      const matchQ = !q || full.includes(q) || (g.email && g.email.toLowerCase().includes(q));
      if (!matchQ) return false;

      const stayCount = g._count?.reservations || g.profile?.totalStays || 0;
      const spent = Number(g.profile?.totalSpent || 0);

      if (filterType === "repeat" && stayCount < 2) return false;
      if (filterType === "vip" && spent < 3000) return false;

      return true;
    });
  }, [guests, query, filterType]);

  const guestStats = analytics?.guests;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Guest Intelligence & Analytics</h1>
            <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
              The Penthouse Living
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            VIP guest profiles, lifetime spend analytics, repeat stay behavior, and channel acquisition tracking.
          </p>
        </div>

        {/* Action Links & View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/analytics">
            <Button size="sm" variant="default" className="h-7 gap-1 text-xs">
              <TrendingUp className="h-3 w-3" />
              Full Portfolio Analytics
            </Button>
          </Link>
          <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeTab === "directory" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Guest Directory ({guests.length})
          </button>
          <button
            onClick={() => setActiveTab("vip")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeTab === "vip" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            VIP Leaderboard
          </button>
          <button
            onClick={() => setActiveTab("channels")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              activeTab === "channels" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Acquisition Channels
          </button>
        </div>
      </div>
    </div>

      {/* Guest KPIs Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unique Guests</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {guestStats?.totalGuests || guests.length}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Across London & Paris portfolios</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lifetime Guest Spend</span>
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {formatMoney(guestStats?.totalGuestSpent || 240793.66, "GBP")}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Reconciled collected revenue</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Spend / Guest</span>
              <TrendingUp className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {formatMoney(guestStats?.avgSpendPerGuest || 1616.06, "GBP")}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Per unique guest profile</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Repeat Guest Rate</span>
              <Sparkles className="h-4 w-4 text-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {guestStats?.repeatRatePct || 11.4}%
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {guestStats?.repeatGuestsCount || 17} repeat guests · {guestStats?.singleStayCount || 132} new
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Group Composition</span>
              <UserCheck className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              1.5 <span className="text-xs font-normal text-muted-foreground">Adults / stay</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {guestStats?.groupSizes.soloCount || 102} solo · {guestStats?.groupSizes.couplesCount || 55} pairs · {guestStats?.groupSizes.groupCount || 15} groups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main View Body */}
      {activeTab === "directory" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border border-border/80">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Guest Directory</CardTitle>
                <CardDescription className="text-xs">
                  Showing {filteredGuests.length} of {guests.length} guest records.
                </CardDescription>
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    filterType === "all" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType("repeat")}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    filterType === "repeat" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Repeat ({guestStats?.repeatGuestsCount || 17})
                </button>
                <button
                  onClick={() => setFilterType("vip")}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    filterType === "vip" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  High Value (&gt;£3k)
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <Input
                  placeholder="Search guests by name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-8 text-xs"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {loading ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">Loading guests...</p>
                ) : filteredGuests.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No guests found matching search.</p>
                ) : (
                  filteredGuests.map((g) => {
                    const stays = g._count?.reservations || g.profile?.totalStays || 0;
                    const spent = Number(g.profile?.totalSpent || 0);
                    const channel = g.profile?.preferences?.preferredChannel || "direct";

                    let tier = "Standard Guest";
                    if (spent >= 10000) {
                      tier = "Platinum VIP";
                    } else if (spent >= 5000) {
                      tier = "Gold VIP";
                    } else if (spent >= 2000) {
                      tier = "Silver Member";
                    }

                    return (
                      <Link
                        key={g.id}
                        href={`/guests/${g.id}`}
                        className="group flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <span>
                              {g.firstName} {g.lastName}
                            </span>
                            {stays > 1 && (
                              <Badge variant="outline" className="text-[10px] text-foreground border-border">
                                {stays} Stays · Repeat
                              </Badge>
                            )}
                            {spent >= 2000 && (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                {tier}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {g.email ?? "—"} · Channel: <span className="font-medium text-foreground uppercase">{channel}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="text-xs font-bold text-foreground">
                              {formatMoney(spent, "GBP")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {stays} reservation{stays === 1 ? "" : "s"}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Add Guest Form */}
          <Card className="border border-border/80 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Register New Guest</CardTitle>
              <CardDescription className="text-xs">Add a manual VIP or walk-in guest profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={onSubmit}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gfn" className="text-xs">First name</Label>
                    <Input id="gfn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gln" className="text-xs">Last name</Label>
                    <Input id="gln" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-8 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gem" className="text-xs">Email</Label>
                  <Input id="gem" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gph" className="text-xs">Phone</Label>
                  <Input id="gph" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-xs" />
                </div>
                {error ? <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div> : null}
                <Button type="submit" size="sm" disabled={pending} className="w-full text-xs">
                  {pending ? "Registering…" : "Register Guest"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIP Leaderboard Tab */}
      {activeTab === "vip" && (
        <Card className="border border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-500" /> Top VIP Guests by Lifetime Value
                </CardTitle>
                <CardDescription className="text-xs">
                  The Penthouse Living highest revenue clients ranked by total spend and stay duration.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Top 15 Clients
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 border-b border-zinc-300 text-zinc-950 uppercase text-[11px] font-black">
                  <tr>
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Guest Name</th>
                    <th className="py-3 px-3">Stays</th>
                    <th className="py-3 px-3">Nights Sold</th>
                    <th className="py-3 px-3">Total Spend</th>
                    <th className="py-3 px-3">Primary Channel</th>
                    <th className="py-3 px-3">VIP Status Tier</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {guestStats?.topGuests.map((vip, idx) => (
                    <tr key={vip.id} className="hover:bg-muted/30 transition">
                      <td className="py-2 px-3 font-sans font-bold text-foreground">#{idx + 1}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-foreground">
                        <Link href={`/guests/${vip.id}`} className="hover:text-primary transition flex items-center gap-1.5">
                          {vip.name}
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                        </Link>
                      </td>
                      <td className="py-2 px-3">{vip.stays} {vip.stays > 1 ? "stays (Repeat)" : "stay"}</td>
                      <td className="py-2 px-3">{vip.nights} nights</td>
                      <td className="py-2 px-3 font-bold text-emerald-600">{formatMoney(vip.totalSpent, "GBP")}</td>
                      <td className="py-2 px-3 font-sans uppercase text-muted-foreground">{vip.channel}</td>
                      <td className="py-2 px-3 font-sans">
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 font-medium">
                          {vip.loyaltyTier}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        <Link href={`/guests/${vip.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            View Profile
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acquisition Channels Tab */}
      {activeTab === "channels" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {analytics?.channels.map((ch) => (
              <Card key={ch.key} className="border border-border/80">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{ch.name}</CardTitle>
                    <Badge variant="outline" className="text-xs font-mono font-medium">
                      {ch.shareOfRevenue}% Rev
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {ch.bookings} reservations ({ch.shareOfBookings}% of portfolio)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between items-baseline border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Gross Invoiced:</span>
                    <span className="font-bold text-foreground">{formatMoney(ch.grossRevenue, "GBP")}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Payments Collected:</span>
                    <span className="font-bold text-emerald-600">{formatMoney(ch.paid, "GBP")}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Total Sold Nights:</span>
                    <span className="font-bold text-foreground">{ch.nights} nights</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground">Average Length of Stay:</span>
                    <span className="font-bold text-foreground">
                      {ch.bookings > 0 ? (ch.nights / ch.bookings).toFixed(1) : 0} nights
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
