"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Download,
  Calendar,
  Building2,
  TrendingUp,
  DollarSign,
  BedDouble,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  ArrowDownToLine,
  Filter,
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

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ReportData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rangePreset, setRangePreset] = React.useState<"7d" | "30d" | "90d" | "month">("30d");
  const [propertyId, setPropertyId] = React.useState<string>("");
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string }>>([]);

  const fetchReports = React.useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let start = new Date();

      if (rangePreset === "7d") {
        start = new Date(now.getTime() - 7 * 86400000);
      } else if (rangePreset === "30d") {
        start = new Date(now.getTime() - 30 * 86400000);
      } else if (rangePreset === "90d") {
        start = new Date(now.getTime() - 90 * 86400000);
      } else if (rangePreset === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const params = new URLSearchParams({
        startDate: start.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
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
  }, [rangePreset, propertyId, toast]);

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

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial & Operational Reports</h1>
          <p className="text-sm text-muted-foreground">
            Audited performance analytics, ADR, RevPAR, and RFC 4180 CSV exports.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {properties.length > 1 && (
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground font-medium"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
            <button
              onClick={() => setRangePreset("7d")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "7d" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              7 Days
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
              onClick={() => setRangePreset("month")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setRangePreset("90d")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                rangePreset === "90d" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              90 Days
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={() => void fetchReports()} disabled={loading} className="h-8 px-2.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
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
              <p className="text-xs text-muted-foreground">Download ledger-grade RFC 4180 CSV exports for external accountants.</p>
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
                {data ? `$${Number(data.adr).toFixed(2)}` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Room revenue: {data ? `$${Number(data.roomRevenue).toFixed(2)}` : "—"}
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
                {data ? `$${Number(data.revpar).toFixed(2)}` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total rooms capacity: {data?.totalRooms ?? 0}
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
                {data ? `$${Number(data.outstandingBalance).toFixed(2)}` : "—"}
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
              Period: {data?.period.startDate} to {data?.period.endDate} ({data?.period.daysCount} days).
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {data?.dailyBreakdown.length || 0} Days Recorded
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
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
                ) : !data || data.dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-sans">
                      No daily records found for the selected timeframe.
                    </td>
                  </tr>
                ) : (
                  data.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-muted/30 transition">
                      <td className="py-2 px-3 font-sans font-medium text-foreground">{row.date}</td>
                      <td className="py-2 px-3">{row.roomsSold}</td>
                      <td className="py-2 px-3">{row.occupancyRate.toFixed(1)}%</td>
                      <td className="py-2 px-3">${row.roomRevenue}</td>
                      <td className="py-2 px-3">${row.adr}</td>
                      <td className="py-2 px-3 text-primary font-semibold">${row.revpar}</td>
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
