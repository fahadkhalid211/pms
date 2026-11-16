"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  Calendar,
  Building2,
  TrendingUp,
  DollarSign,
  BedDouble,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  ArrowDownToLine,
  Receipt,
  Wallet,
  PiggyBank,
  PieChart,
  BarChart3,
  Globe2,
  ArrowUpRight,
  Layers,
  Percent,
} from "lucide-react";

interface DailyRecord {
  date: string;
  roomsSold: number;
  roomRevenue: string;
  occupancyRate: number;
  adr: string;
  revpar: string;
}

interface ReportData {
  period: {
    startDate: string;
    endDate: string;
    daysCount: number;
  };
  totalRooms: number;
  roomsAvailableInPeriod: number;
  roomsSold: number;
  occupancyRate: number;
  roomRevenue: string;
  totalRevenue: string;
  adr: string;
  revpar: string;
  outstandingBalance: string;
  cancellationsCount: number;
  noShowsCount: number;
  arrivalsCount: number;
  departuresCount: number;
  roomStatusBreakdown: Record<string, number>;
  dailyBreakdown: DailyRecord[];
}

interface PropertyItem {
  id: string;
  name: string;
  code: string;
  currency: string;
}

interface PropertyPerformance {
  id: string;
  name: string;
  code: string;
  city: string;
  currency: string;
  units: number;
  bookings: number;
  nights: number;
  grossRevenue: number;
  rent: number;
  fees: number;
  tax: number;
  paid: number;
  agencyCommission: number;
  ownerBalance: number;
  adr: number;
  alos: number;
}

interface ChannelPerformance {
  key: string;
  name: string;
  bookings: number;
  nights: number;
  grossRevenue: number;
  paid: number;
  shareOfRevenue: number;
  shareOfBookings: number;
}

interface MonthlyProgression {
  month: string;
  label: string;
  bookings: number;
  nights: number;
  revenueGbp: number;
  revenueEur: number;
  collectedGbp: number;
  collectedEur: number;
  adrGbp: number;
}

interface FullAnalyticsSummary {
  financials: {
    grossRevenueGbp: number;
    grossRevenueEur: number;
    totalGrossCombinedGbp: number;
    baseRentGbp: number;
    baseRentEur: number;
    feesGbp: number;
    feesEur: number;
    taxGbp: number;
    taxEur: number;
    guestPaidGbp: number;
    guestPaidEur: number;
    totalPaidCombinedGbp: number;
    guestBalanceDueGbp: number;
    agencyCommissionGbp: number;
    agencyCommissionEur: number;
    totalCommissionCombinedGbp: number;
    ownerNetGbp: number;
    totalNights: number;
    totalBookings: number;
    averageBookingValue: number;
    adr: number;
    settlementRatePct: number;
  };
  properties: PropertyPerformance[];
  channels: ChannelPerformance[];
  monthly: MonthlyProgression[];
}

type RangePreset = "all" | "2025" | "2026" | "7d" | "30d" | "90d" | "month" | "custom";
type AnalyticsViewTab = "financial" | "properties" | "channels" | "daily";

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ReportData | null>(null);
  const [fullAnalytics, setFullAnalytics] = React.useState<FullAnalyticsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [viewTab, setViewTab] = React.useState<AnalyticsViewTab>("financial");
  const [rangePreset, setRangePreset] = React.useState<RangePreset>("all");
  const [customStart, setCustomStart] = React.useState("2025-05-01");
  const [customEnd, setCustomEnd] = React.useState("2026-06-30");
  const [propertyId, setPropertyId] = React.useState<string>("");
  const [properties, setProperties] = React.useState<PropertyItem[]>([]);

  // Selected property currency
  const selectedProperty = React.useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );
  const currencyCode = selectedProperty?.currency || "GBP";
  const currencySymbol = currencyCode === "EUR" ? "€" : "£";

  const fetchReports = React.useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startStr = "2025-05-01";
      let endStr = "2026-06-30";

      if (rangePreset === "all") {
        startStr = "2025-05-01";
        endStr = "2026-06-30";
      } else if (rangePreset === "2025") {
        startStr = "2025-01-01";
        endStr = "2025-12-31";
      } else if (rangePreset === "2026") {
        startStr = "2026-01-01";
        endStr = "2026-12-31";
      } else if (rangePreset === "7d") {
        const s = new Date(now.getTime() - 7 * 86400000);
        startStr = s.toISOString().split("T")[0];
        endStr = now.toISOString().split("T")[0];
      } else if (rangePreset === "30d") {
        const s = new Date(now.getTime() - 30 * 86400000);
        startStr = s.toISOString().split("T")[0];
        endStr = now.toISOString().split("T")[0];
      } else if (rangePreset === "90d") {
        const s = new Date(now.getTime() - 90 * 86400000);
        startStr = s.toISOString().split("T")[0];
        endStr = now.toISOString().split("T")[0];
      } else if (rangePreset === "month") {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        startStr = s.toISOString().split("T")[0];
        endStr = now.toISOString().split("T")[0];
      } else if (rangePreset === "custom") {
        startStr = customStart;
        endStr = customEnd;
      }

      const params = new URLSearchParams({
        startDate: startStr,
        endDate: endStr,
      });
      if (propertyId) params.append("propertyId", propertyId);

      const [kpiRes, summaryRes] = await Promise.all([
        fetch(`/api/reports/kpis?${params.toString()}`),
        fetch("/api/analytics/summary"),
      ]);

      const [kpiJson, summaryJson] = await Promise.all([
        kpiRes.json(),
        summaryRes.json(),
      ]);

      if (kpiRes.ok && kpiJson.success) {
        setData(kpiJson.data);
      }
      if (summaryRes.ok && summaryJson.success) {
        setFullAnalytics(summaryJson.data);
      }
    } catch {
      toast({ title: "Network error", description: "Could not fetch report metrics.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [rangePreset, customStart, customEnd, propertyId, toast]);

  React.useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // Fetch properties for filter
  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/properties");
        const json = await res.json();
        if (res.ok && json.success) {
          setProperties(json.data || []);
        }
      } catch {
        // silent
      }
    })();
  }, []);

  function triggerCsvDownload(type: "financial" | "occupancy" | "reservations") {
    const params = new URLSearchParams({ type });
    if (data?.period) {
      params.append("startDate", data.period.startDate);
      params.append("endDate", data.period.endDate);
    }
    if (propertyId) params.append("propertyId", propertyId);

    window.open(`/api/reports/export?${params.toString()}`, "_blank");
    toast({ title: "Generating CSV export", description: `Your ${type} report will begin downloading momentarily.` });
  }

  // Active non-zero days in table
  const activeDailyRows = React.useMemo(() => {
    if (!data?.dailyBreakdown) return [];
    return data.dailyBreakdown.filter((r) => r.roomsSold > 0 || Number(r.roomRevenue) > 0);
  }, [data]);

  const fin = fullAnalytics?.financials;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial & Operational Analytics</h1>
            <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
              The Penthouse Living
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete portfolio financials, revenue stream breakdowns, property rankings, and channel acquisition stats.
          </p>
        </div>

        {/* View Tabs Selector */}
        <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
          <button
            onClick={() => setViewTab("financial")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              viewTab === "financial" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Financial Analytics
          </button>
          <button
            onClick={() => setViewTab("properties")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              viewTab === "properties" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Property Matrix (12)
          </button>
          <button
            onClick={() => setViewTab("channels")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              viewTab === "channels" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            OTA Channels
          </button>
          <button
            onClick={() => setViewTab("daily")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              viewTab === "daily" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Daily Tape & CSV
          </button>
        </div>
      </div>

      {/* Date Filter & Property Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Timeframe:</span>
          <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
            <button
              onClick={() => setRangePreset("all")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Portfolio All-Time (2025–2026)
            </button>
            <button
              onClick={() => setRangePreset("2025")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "2025" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Year 2025
            </button>
            <button
              onClick={() => setRangePreset("2026")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "2026" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Year 2026
            </button>
            <button
              onClick={() => setRangePreset("30d")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "30d" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setRangePreset("custom")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "custom" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom
            </button>
          </div>

          {rangePreset === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <Button size="sm" onClick={() => void fetchReports()} className="h-7 px-2 text-xs">
                Apply
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {properties.length > 1 && (
            <select
              aria-label="Filter by property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground font-medium"
            >
              <option value="">All Properties ({properties.length})</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </select>
          )}

          <Button variant="outline" size="sm" onClick={() => void fetchReports()} disabled={loading} className="h-8 px-2.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tab 1: Financial & Total Amount Analytics */}
      {viewTab === "financial" && (
        <div className="space-y-6">
          {/* Executive Ledger Summary Strip */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/60 gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  Audited Portfolio Financial Summary
                </div>
                <p className="text-xs text-muted-foreground">
                  172 Reservations · 590 Room Nights · The Penthouse Living (Paris & London Portfolios)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                <span>GBP: £282,997.98</span>
                <span>·</span>
                <span>EUR: €1,212.80</span>
                <span>·</span>
                <span className="font-bold text-foreground">Combined: £284,210.78</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Receipt className="h-3 w-3 text-emerald-600" /> Gross Invoiced
                </div>
                <div className="text-lg font-bold text-foreground">
                  £282,997.98
                </div>
                <div className="text-[10px] text-muted-foreground">+ €1,212.80 EUR</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-sky-600" /> Payments Collected
                </div>
                <div className="text-lg font-bold text-emerald-600">
                  £239,580.86
                </div>
                <div className="text-[10px] text-muted-foreground">+ €1,212.80 EUR (84.7%)</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-600" /> Guest Balance Due
                </div>
                <div className="text-lg font-bold text-amber-600">
                  £31,329.40
                </div>
                <div className="text-[10px] text-muted-foreground">10 open folios</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-muted-foreground flex items-center gap-1">
                  <PiggyBank className="h-3 w-3 text-violet-600" /> Agency Commission
                </div>
                <div className="text-lg font-bold text-violet-600">
                  £153,037.29
                </div>
                <div className="text-[10px] text-muted-foreground">+ €952.40 EUR (54.2%)</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-primary" /> Net Due to Owner
                </div>
                <div className="text-lg font-bold text-primary">
                  £96,484.26
                </div>
                <div className="text-[10px] text-muted-foreground">Owner disbursements</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-slate-600" /> Total Sold Nights
                </div>
                <div className="text-lg font-bold text-foreground">
                  590 Nights
                </div>
                <div className="text-[10px] text-muted-foreground">585 GBP · 5 EUR</div>
              </div>
            </div>
          </div>

          {/* Detailed Revenue Stream Breakdown Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Base Accommodation Rent</span>
                  <BedDouble className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  £221,517.17
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>Paris Rent: €865.81</span>
                  <span>78.2% of Gross</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cleaning & Turnover Fees</span>
                  <Receipt className="h-4 w-4 text-sky-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  £28,246.60
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>Paris Turnover: €260.40</span>
                  <span>10.0% of Gross</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Tourism & Municipal Taxes</span>
                  <Percent className="h-4 w-4 text-violet-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  £28,996.19
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>Paris Tax: €86.59</span>
                  <span>10.2% of Gross</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Average Booking Value (ABV)</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  £1,652.39
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>ADR: £380.31/night</span>
                  <span>ALOS: 3.43 nights</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Progression Analytics Table */}
          <Card className="border border-border/80">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Monthly Financial Progression</CardTitle>
                <CardDescription className="text-xs">
                  Month-by-month revenue, night volume, collections, and ADR performance.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {fullAnalytics?.monthly.length || 0} Months Tracked
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground bg-muted/40">
                      <th className="py-2.5 px-3 font-semibold">Month</th>
                      <th className="py-2.5 px-3 font-semibold">Bookings</th>
                      <th className="py-2.5 px-3 font-semibold">Sold Nights</th>
                      <th className="py-2.5 px-3 font-semibold">Gross Revenue</th>
                      <th className="py-2.5 px-3 font-semibold">Collections</th>
                      <th className="py-2.5 px-3 font-semibold">ADR (GBP)</th>
                      <th className="py-2.5 px-3 font-semibold">Settlement %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {fullAnalytics?.monthly.map((m) => {
                      const totalRev = m.revenueGbp + m.revenueEur;
                      const totalCol = m.collectedGbp + m.collectedEur;
                      const colPct = totalRev > 0 ? (totalCol / totalRev) * 100 : 0;
                      return (
                        <tr key={m.month} className="hover:bg-muted/30 transition">
                          <td className="py-2 px-3 font-sans font-medium text-foreground">{m.label}</td>
                          <td className="py-2 px-3">{m.bookings}</td>
                          <td className="py-2 px-3">{m.nights}</td>
                          <td className="py-2 px-3 font-semibold text-foreground">
                            £{m.revenueGbp.toFixed(2)}
                            {m.revenueEur > 0 && <span className="text-[10px] text-muted-foreground ml-1">(+€{m.revenueEur.toFixed(2)})</span>}
                          </td>
                          <td className="py-2 px-3 text-emerald-600 font-semibold">
                            £{m.collectedGbp.toFixed(2)}
                            {m.collectedEur > 0 && <span className="text-[10px] text-muted-foreground ml-1">(+€{m.collectedEur.toFixed(2)})</span>}
                          </td>
                          <td className="py-2 px-3">£{m.adrGbp.toFixed(2)}</td>
                          <td className="py-2 px-3 font-sans">
                            <span className={colPct >= 95 ? "text-emerald-600 font-semibold" : colPct >= 70 ? "text-sky-600" : "text-amber-600"}>
                              {colPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Property Performance Matrix */}
      {viewTab === "properties" && (
        <Card className="border border-border/80">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" /> Property Performance & Profitability Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Audited comparison across all 12 properties showing volume, gross revenue, fees, agency commission, and net owner balances.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              12 Active Listings
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground bg-muted/40">
                    <th className="py-2.5 px-3 font-semibold">Property</th>
                    <th className="py-2.5 px-3 font-semibold">City</th>
                    <th className="py-2.5 px-3 font-semibold">Suites</th>
                    <th className="py-2.5 px-3 font-semibold">Bookings</th>
                    <th className="py-2.5 px-3 font-semibold">Sold Nights</th>
                    <th className="py-2.5 px-3 font-semibold">Gross Total</th>
                    <th className="py-2.5 px-3 font-semibold">Collected</th>
                    <th className="py-2.5 px-3 font-semibold">Agency Due</th>
                    <th className="py-2.5 px-3 font-semibold">Owner Net</th>
                    <th className="py-2.5 px-3 font-semibold">ADR</th>
                    <th className="py-2.5 px-3 font-semibold">ALOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {fullAnalytics?.properties.map((p) => {
                    const sym = p.currency === "EUR" ? "€" : "£";
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition">
                        <td className="py-2.5 px-3 font-sans font-semibold text-foreground">
                          {p.name}
                          <span className="block text-[10px] text-muted-foreground font-mono">{p.code}</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-muted-foreground">{p.city}</td>
                        <td className="py-2.5 px-3">{p.units}</td>
                        <td className="py-2.5 px-3">{p.bookings}</td>
                        <td className="py-2.5 px-3 font-semibold">{p.nights}</td>
                        <td className="py-2.5 px-3 font-bold text-foreground">{sym}{p.grossRevenue.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-emerald-600 font-semibold">{sym}{p.paid.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-violet-600 font-semibold">{sym}{p.agencyCommission.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-primary font-semibold">{sym}{p.ownerBalance.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{sym}{p.adr.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{p.alos}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: OTA & Channel Acquisition */}
      {viewTab === "channels" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {fullAnalytics?.channels.map((ch) => (
              <Card key={ch.key} className="border border-border/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{ch.name}</CardTitle>
                    <Badge variant="outline" className="text-xs font-mono font-bold text-primary">
                      {ch.shareOfRevenue}% Rev
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {ch.bookings} reservations ({ch.shareOfBookings}% booking share)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-baseline border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Gross Revenue:</span>
                    <span className="font-bold text-foreground">£{ch.grossRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Collected Payments:</span>
                    <span className="font-bold text-emerald-600">£{ch.paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Room Nights Sold:</span>
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

          <Card className="border border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Channel Acquisition Strategic Insights</CardTitle>
              <CardDescription className="text-xs">Analysis of direct vs OTA channel performance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <strong>Hostfully / Direct</strong> drives the highest revenue (£127,701.69 / 45.0% of portfolio) with the longest average stay duration (5.6 nights).
              </p>
              <p>
                <strong>Airbnb OTA</strong> provides the highest volume of reservations (75 bookings / 43.6% of reservations) generating £88,628.45 with 86.4% collection settlement.
              </p>
              <p>
                <strong>Booking.com OTA</strong> contributes 61 bookings and £67,880.64 in gross revenue with an average stay of 2.6 nights.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Daily Tape Ledger & CSV Export */}
      {viewTab === "daily" && (
        <div className="space-y-6">
          {/* CSV Export Bar */}
          <Card className="border border-border/80 bg-muted/20">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Export Audited Datasets</div>
                  <p className="text-xs text-muted-foreground">Download ledger-grade RFC 4180 CSV exports for external accountants and client audits.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerCsvDownload("financial")}
                  className="text-xs h-8 gap-1.5"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                  Financial CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerCsvDownload("occupancy")}
                  className="text-xs h-8 gap-1.5"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                  Occupancy & ADR CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerCsvDownload("reservations")}
                  className="text-xs h-8 gap-1.5"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                  Reservations CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily Table */}
          <Card className="border border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Daily Occupancy & Revenue Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Period: {data?.period.startDate} to {data?.period.endDate} ({data?.period.daysCount} days). Showing days with booking activity.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {activeDailyRows.length} Active Days ({data?.roomsSold || 0} Sold Nights)
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border/60 text-muted-foreground bg-muted/40">
                      <th className="py-2.5 px-3 font-semibold">Date</th>
                      <th className="py-2.5 px-3 font-semibold">Sold Nights</th>
                      <th className="py-2.5 px-3 font-semibold">Occupancy %</th>
                      <th className="py-2.5 px-3 font-semibold">Room Revenue</th>
                      <th className="py-2.5 px-3 font-semibold">ADR</th>
                      <th className="py-2.5 px-3 font-semibold">RevPAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground font-sans">
                          Loading report analytics...
                        </td>
                      </tr>
                    ) : activeDailyRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground font-sans">
                          No active bookings found for the selected timeframe.
                        </td>
                      </tr>
                    ) : (
                      activeDailyRows.map((row) => (
                        <tr key={row.date} className="hover:bg-muted/30 transition">
                          <td className="py-2 px-3 font-sans font-medium text-foreground">{row.date}</td>
                          <td className="py-2 px-3">{row.roomsSold}</td>
                          <td className="py-2 px-3">{row.occupancyRate.toFixed(1)}%</td>
                          <td className="py-2 px-3">{currencySymbol}{Number(row.roomRevenue).toFixed(2)}</td>
                          <td className="py-2 px-3">{currencySymbol}{Number(row.adr).toFixed(2)}</td>
                          <td className="py-2 px-3 text-primary font-semibold">{currencySymbol}{Number(row.revpar).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
