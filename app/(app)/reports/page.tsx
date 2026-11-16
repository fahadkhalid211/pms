"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/utils";
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

type RangePreset = "all" | "2025" | "2026" | "7d" | "30d" | "90d" | "month" | "custom";

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ReportData | null>(null);
  const [loading, setLoading] = React.useState(true);
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

      const res = await fetch(`/api/reports/kpis?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      } else {
        toast({ title: "Failed to load reports", description: json.error?.message, variant: "destructive" });
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
    // Show days that have sold rooms or revenue, plus recent days
    return data.dailyBreakdown.filter((r) => r.roomsSold > 0 || Number(r.roomRevenue) > 0);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial & Operational Reports</h1>
            <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
              The Penthouse Living
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audited performance analytics, multi-currency revenue reconciliations, and RFC 4180 CSV exports.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
            <button
              onClick={() => setRangePreset("all")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Portfolio All-Time
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
              30 Days
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

          <Button variant="outline" size="sm" onClick={() => void fetchReports()} disabled={loading} className="h-8 px-2.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Custom Range Inputs */}
      {rangePreset === "custom" && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-xs">
          <span className="font-semibold text-foreground">Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">From:</label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">To:</label>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <Button size="sm" onClick={() => void fetchReports()} className="h-8 text-xs">
            Apply
          </Button>
        </div>
      )}

      {/* Client Financial Ledger Card (Reconciled from Google Sheet) */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/60 gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Audited Portfolio Financial Summary
            </div>
            <p className="text-xs text-muted-foreground">
              Period: {data?.period.startDate || "01/05/2025"} to {data?.period.endDate || "30/06/2026"} ({data?.period.daysCount || 426} days) · The Penthouse Living
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono font-normal">
            172 Reservations · 590 Sold Nights
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3 w-3 text-emerald-600" /> Gross Revenue
            </div>
            <div className="text-lg font-bold text-foreground">
              £282,997.98
            </div>
            <div className="text-[10px] text-muted-foreground">+ €1,212.80 EUR</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3 text-sky-600" /> Guest Paid
            </div>
            <div className="text-lg font-bold text-emerald-600">
              £239,580.86
            </div>
            <div className="text-[10px] text-muted-foreground">+ €1,212.80 EUR (100% Paris)</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-600" /> Guest Balance Due
            </div>
            <div className="text-lg font-bold text-amber-600">
              £31,329.40
            </div>
            <div className="text-[10px] text-muted-foreground">Open folios</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <PiggyBank className="h-3 w-3 text-violet-600" /> Agency Commission
            </div>
            <div className="text-lg font-bold text-violet-600">
              £153,037.29
            </div>
            <div className="text-[10px] text-muted-foreground">+ €952.40 EUR</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-primary" /> Net Due to Owner
            </div>
            <div className="text-lg font-bold text-primary">
              £96,484.26
            </div>
            <div className="text-[10px] text-muted-foreground">Owner disbursement</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-600" /> Room Nights Sold
            </div>
            <div className="text-lg font-bold text-foreground">
              590 Nights
            </div>
            <div className="text-[10px] text-muted-foreground">585 GBP · 5 EUR</div>
          </div>
        </div>
      </div>

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

      {/* Primary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Occupancy Rate</span>
              <BedDouble className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {data ? `${data.occupancyRate}%` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data ? `${data.roomsSold} of ${data.roomsAvailableInPeriod} room nights sold` : "Loading..."}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ADR (Avg Daily Rate)</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {data ? `${currencySymbol}${Number(data.adr).toFixed(2)}` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Room rent: {data ? `${currencySymbol}${Number(data.roomRevenue).toFixed(2)}` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">RevPAR</span>
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {data ? `${currencySymbol}${Number(data.revpar).toFixed(2)}` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total unit capacity: {data?.totalRooms ?? 0} suites
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unsettled Balance</span>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {data ? `${currencySymbol}${Number(data.outstandingBalance).toFixed(2)}` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Open & overdue invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Performance Breakdown Table */}
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
  );
}
