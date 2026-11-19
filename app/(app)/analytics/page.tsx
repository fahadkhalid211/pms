"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  TrendingUp,
  Building2,
  Calendar,
  Receipt,
  Wallet,
  PiggyBank,
  RefreshCw,
  Globe2,
  PieChart as PieChartIcon,
  Crown,
  Sparkles,
  FileSpreadsheet,
  ShieldCheck,
  Zap,
  Bed,
  MapPin,
  Clock,
  Landmark,
  ArrowUpRight,
  CheckCircle2,
  Flame,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  calculateFiftyOneModel,
  FIFTY_ONE_DIRECT_COSTS,
  FIFTY_ONE_REVENUE_COSTS,
  FIFTY_ONE_SERVICES,
  type FiftyOneSimulationResult,
} from "@/lib/fifty-one-london";
import {
  generatePredictivePortfolioModel,
  type PredictivePortfolioModel,
} from "@/lib/predictive-pms";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

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

interface PortfolioAnalyticsData {
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
}

type MainTabKey = "predictive" | "fifty_one" | "services" | "portfolio";

// Luxury Monochrome Palette (Black, Zinc, Slate & Crisp Accent Highlights)
const MONO_CHART_COLORS = [
  "#18181b", // obsidian black
  "#3f3f46", // zinc 700
  "#71717a", // zinc 500
  "#a1a1aa", // zinc 400
  "#0284c7", // institutional sapphire
  "#059669", // emerald profit
  "#d97706", // amber yield
  "#475569", // slate 600
];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<MainTabKey>("predictive");
  const [isMounted, setIsMounted] = React.useState(false);

  // Models
  const [portfolioData, setPortfolioData] = React.useState<PortfolioAnalyticsData | null>(null);
  const [fiftyOneModel, setFiftyOneModel] = React.useState<FiftyOneSimulationResult>(() =>
    calculateFiftyOneModel()
  );
  const [predictiveModel, setPredictiveModel] = React.useState<PredictivePortfolioModel>(() =>
    generatePredictivePortfolioModel()
  );

  // Filter for services catalog
  const [serviceFilter, setServiceFilter] = React.useState<"all" | "all_inclusive" | "partner_perk">("all");

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/summary");
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.portfolio) setPortfolioData(json.data.portfolio);
        if (json.data?.fiftyOneLondon) setFiftyOneModel(json.data.fiftyOneLondon);
        if (json.data?.predictiveModel) setPredictiveModel(json.data.predictiveModel);
      }
    } catch {
      toast({
        title: "Note",
        description: "Operating with local audited portfolio & predictive models.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export full institutional forecast as CSV
  const handleExportCSV = () => {
    try {
      const lines: string[] = [
        "Pent House PMS — Institutional 5-Year Predictive Financial Model & Fifty One London",
        "Asset: Fifty One London, 51-55 Cromwell Road, South Kensington SW7",
        "Operator: The Penthouse Living (TPL)",
        `Export Date: ${new Date().toISOString()}`,
        "",
        "--- 5-YEAR PREDICTIVE PROFIT FORECAST ---",
        "Year,Academic Year,Keys,Occupancy (%),Base Rent (£),Superior Studios (£),Summer Void Lets (£),Ancillary Upsells (£),Gross Revenue (£),Direct OpEx (£),Revenue-Linked (£),Total OpEx (£),EBITDA / NOI (£),EBITDA Margin (%),Rev / Key (£),EBITDA / Key (£),Asset Valuation (£),Cumulative Cashflow (£)",
        ...predictiveModel.fiveYearForecast.map(
          (y) =>
            `${y.year},"${y.academicYear}",${y.totalKeys},${y.occupancyPct}%,${y.baseRentRevenue},${y.superiorStudioRevenue},${y.summerVoidMonetization},${y.ancillaryServicesIncome},${y.grossRevenue},${y.directOperatingCosts},${y.revenueLinkedCosts},${y.totalOperatingCosts},${y.ebitda},${y.ebitdaMarginPct}%,${y.annualizedRevPerKey},${y.annualizedEbitdaPerKey},${y.assetValuationAt525Cap},${y.cumulativeCashflow}`
        ),
        "",
        "--- VALUE-ADD EXPANSION LEVERS ---",
        "Lever,Category,Annual Impact (£),Margin Uplift (%),Timeline,Description",
        ...predictiveModel.valueAddLevers.map(
          (v) =>
            `"${v.title}","${v.category}",${v.annualImpactGbp},+${v.marginImpactPct}%,"${v.implementationTimeline}","${v.description}"`
        ),
        "",
        "--- FIFTY ONE LONDON INVENTORY ---",
        "Room Type,Keys,44-Wk Rate (£/wk),51-Wk Rate (£/wk),Model Revenue (£),Share (%),Size,Description",
        ...fiftyOneModel.roomTypes.map(
          (rt) =>
            `"${rt.name}",${rt.keys},${rt.rate44Week},${rt.rate51Week},${rt.modelOccupancyRevenue},${rt.shareOfRevenuePct}%,${rt.sizeM2},"${rt.description}"`
        ),
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Pent_House_PMS_5Year_Predictive_Model_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Export Completed",
        description: "5-Year predictive financial forecast and model exported to CSV.",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err?.message || "Failed to generate CSV export",
        variant: "destructive",
      });
    }
  };

  const fmtGbp = (n: number) =>
    `£${Math.round(n).toLocaleString("en-GB")}`;

  const filteredServices = React.useMemo(() => {
    if (serviceFilter === "all") return FIFTY_ONE_SERVICES;
    return FIFTY_ONE_SERVICES.filter((s) => s.category === serviceFilter);
  }, [serviceFilter]);

  // Chart Data for 5-Year Trajectory
  const fiveYearTrajectoryData = React.useMemo(() => {
    return predictiveModel.fiveYearForecast.map((y) => ({
      year: y.academicYear.replace(" (Base)", "").replace(" (Optimized)", "").replace(" (Direct Scale)", "").replace(" (Smart Automation)", "").replace(" (Institutional Maturity)", ""),
      rawYear: y.year,
      grossRevenueM: Math.round((y.grossRevenue / 1000000) * 100) / 100,
      ebitdaM: Math.round((y.ebitda / 1000000) * 100) / 100,
      opExM: Math.round((y.totalOperatingCosts / 1000000) * 100) / 100,
      marginPct: y.ebitdaMarginPct,
      valuationM: Math.round((y.assetValuationAt525Cap / 1000000) * 10) / 10,
    }));
  }, [predictiveModel]);

  // Chart Data for Revenue Streams Stacking
  const revenueStreamsData = React.useMemo(() => {
    return predictiveModel.fiveYearForecast.map((y) => ({
      year: y.year,
      label: y.academicYear.split(" ")[0],
      baseRent: Math.round(y.baseRentRevenue / 1000),
      summerVoid: Math.round(y.summerVoidMonetization / 1000),
      superiorPenthouse: Math.round(y.superiorStudioRevenue / 1000),
      ancillary: Math.round(y.ancillaryServicesIncome / 1000),
      total: Math.round(y.grossRevenue / 1000),
    }));
  }, [predictiveModel]);

  // Room revenue chart for baseline
  const roomRevenueChartData = React.useMemo(() => {
    return fiftyOneModel.roomTypes
      .filter((rt) => !rt.isSoldOut && rt.modelOccupancyRevenue > 0)
      .map((rt) => ({
        name: rt.name.replace("Studio", "Std").replace("Mezzanine", "Mezz"),
        revenue: Math.round(rt.modelOccupancyRevenue),
        share: rt.shareOfRevenuePct,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [fiftyOneModel]);

  const pHighlights = predictiveModel.executiveHighlights;

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* Top Luxury Monochrome Banner & Header                         */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shadow-md shadow-black/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                Pent House PMS
                <span className="text-xs px-2 py-0.5 rounded-full bg-black text-white font-medium">
                  Institutional Investor Analytics
                </span>
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                Fifty One London · 51-55 Cromwell Road, South Kensington SW7 · Managed by The Penthouse Living (TPL)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 border-black/20 hover:bg-zinc-100 shadow-xs text-xs font-semibold"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export 5-Year Plan CSV
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              toast({
                title: "Data Synchronized",
                description: "Predictive financial forecasts updated with latest operating data.",
              });
              fetchAnalytics();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 bg-black text-white hover:bg-zinc-800 text-xs font-semibold shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Executive Investor KPI Strip                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 border-black/15 bg-card shadow-xs">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5 text-black" /> Y1 Base Revenue
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground mt-1">
            {fmtGbp(pHighlights.baseYearRevenueGbp)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Academic 2025/26 @ 95% Occ
          </div>
        </Card>

        <Card className="p-3.5 border-black/15 bg-card shadow-xs">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Y5 Target Revenue
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {fmtGbp(pHighlights.yearFiveRevenueGbp)}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
            +{pHighlights.fiveYearRevenueCagrPct}% Annualized CAGR
          </div>
        </Card>

        <Card className="p-3.5 border-black/15 bg-card shadow-xs">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-black" /> Y1 EBITDA (NOI)
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground mt-1">
            {fmtGbp(pHighlights.baseYearEbitdaGbp)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            68.8% Base Operating Margin
          </div>
        </Card>

        <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-emerald-600" /> Y5 EBITDA (NOI)
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {fmtGbp(pHighlights.yearFiveEbitdaGbp)}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
            73.4% Target Margin (+4.6%)
          </div>
        </Card>

        <Card className="p-3.5 border-black/15 bg-card shadow-xs">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <PiggyBank className="h-3.5 w-3.5 text-black" /> 5-Yr Asset Equity
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground mt-1">
            {fmtGbp(pHighlights.terminalValuationGbp)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            +£{Math.round((pHighlights.equityValueCreatedGbp) / 1000000)}M Equity Value Added
          </div>
        </Card>

        <Card className="p-3.5 border-black/15 bg-zinc-950 text-white shadow-xs">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Crown className="h-3.5 w-3.5 text-amber-400" /> 5-Yr Free Cashflow
          </div>
          <div className="text-xl md:text-2xl font-black text-white mt-1">
            {fmtGbp(pHighlights.totalFiveYearFreeCashflowGbp)}
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Cumulative Operating Cash
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Navigation Tabs (Monochrome Black & White)                     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-border text-sm overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("predictive")}
          className={`px-4 py-2.5 font-bold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "predictive"
              ? "border-black text-black dark:border-white dark:text-white"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LineChartIcon className="h-4 w-4" />
          5-Year Predictive Plan & Profits
          <Badge className="text-[10px] py-0 px-1.5 bg-black text-white dark:bg-white dark:text-black">
            Forecast
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fifty_one")}
          className={`px-4 py-2.5 font-bold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "fifty_one"
              ? "border-black text-black dark:border-white dark:text-white"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bed className="h-4 w-4" />
          Fifty One London Inventory & Pricing
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("services")}
          className={`px-4 py-2.5 font-bold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "services"
              ? "border-black text-black dark:border-white dark:text-white"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          30 All-Inclusive Services Catalog
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("portfolio")}
          className={`px-4 py-2.5 font-bold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "portfolio"
              ? "border-black text-black dark:border-white dark:text-white"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Serviced Operating Portfolio (12 Units)
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: 5-YEAR PREDICTIVE PROFIT FORECAST & EXPANSION LEVERS   */}
      {/* ============================================================= */}
      {activeTab === "predictive" && (
        <div className="space-y-6">
          {/* Visual Graphs Row: 5-Year Revenue & Profit Trajectory + Equity Growth */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Chart 1: 5-Year Revenue & EBITDA Trajectory */}
            <Card className="border-black/15">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      5-Year Predictive Revenue & EBITDA Growth (£M)
                    </CardTitle>
                    <CardDescription>
                      Gross revenue expanding from £5.95M to £7.72M with EBITDA margin widening to 73.4%
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    +£1.57M Net Profit Uplift
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full pt-2">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={fiveYearTrajectoryData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `£${v}M`} />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            `£${Number(value).toFixed(2)}M`,
                            name === "grossRevenueM" ? "Gross Invoiced Revenue" : "EBITDA Net Operating Income",
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Bar
                          dataKey="grossRevenueM"
                          name="Gross Revenue (£M)"
                          fill="#18181b"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="ebitdaM"
                          name="EBITDA Profit (£M)"
                          fill="#059669"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Rendering forecast chart...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Asset Equity Valuation Trajectory */}
            <Card className="border-black/15">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-black dark:text-white" />
                      Asset Valuation Progression (£M @ 5.25% Cap)
                    </CardTitle>
                    <CardDescription>
                      Implied institutional gross asset value increasing from £78.0M to £108.0M
                    </CardDescription>
                  </div>
                  <Badge className="bg-black text-white dark:bg-white dark:text-black text-xs font-mono font-bold">
                    +£30.0M Equity
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full pt-2">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={fiveYearTrajectoryData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#18181b" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={(v) => `£${v}M`} />
                        <Tooltip formatter={(value: any) => [`£${value}M`, "Asset Capital Value"]} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Area
                          type="monotone"
                          dataKey="valuationM"
                          name="Asset Valuation (£M)"
                          stroke="#18181b"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorVal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Rendering chart...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comprehensive 5-Year Financial Forecast Table */}
          <Card className="border-black/15">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-black" />
                    5-Year Institutional Financial Model (2025/26 → 2029/30)
                  </CardTitle>
                  <CardDescription>
                    Audited academic year baseline extrapolated with 4 core value-add profit expansion levers
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    South Kensington Prime PBSA
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Financial Metric (£ GBP)</th>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <th key={y.year} className="py-2.5 px-3 text-right">
                          {y.academicYear}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right">5-Year Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Operating Metrics */}
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/30 font-semibold">
                      <td className="py-2 px-3 text-foreground" colSpan={7}>
                        1. Operating Metrics & Keys
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Portfolio Keys</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono">
                          {y.totalKeys} keys
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-medium">120 Units</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Occupancy Rate</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono font-medium text-foreground">
                          {y.occupancyPct.toFixed(1)}%
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono text-emerald-600 font-bold">+3.5%</td>
                    </tr>

                    {/* Revenue Breakdown */}
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/30 font-semibold">
                      <td className="py-2 px-3 text-foreground" colSpan={7}>
                        2. Revenue Streams Breakdown
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Core Academic Contract Rent</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono">
                          {fmtGbp(y.baseRentRevenue)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono text-emerald-600">+18.7%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground flex items-center gap-1.5">
                        Superior Studios Activation (2 Keys)
                        <Badge variant="outline" className="text-[9px] py-0 px-1">Value-Add</Badge>
                      </td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono">
                          {y.superiorStudioRevenue > 0 ? fmtGbp(y.superiorStudioRevenue) : "£0 (Sold Out)"}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+£145k/yr</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground flex items-center gap-1.5">
                        Summer Void Monetization (Jul–Aug)
                        <Badge variant="outline" className="text-[9px] py-0 px-1">Yield Lever</Badge>
                      </td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono">
                          {y.summerVoidMonetization > 0 ? fmtGbp(y.summerVoidMonetization) : "£0 (Unmonetized)"}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+£275k/yr</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground flex items-center gap-1.5">
                        Ancillary Services & Upsells
                        <Badge variant="outline" className="text-[9px] py-0 px-1">High-Margin</Badge>
                      </td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono">
                          {y.ancillaryServicesIncome > 0 ? fmtGbp(y.ancillaryServicesIncome) : "£0"}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+£240k/yr</td>
                    </tr>
                    <tr className="bg-zinc-100/70 dark:bg-zinc-800/40 font-bold">
                      <td className="py-2.5 px-3 text-foreground">Total Invoiced Gross Revenue</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2.5 px-3 text-right font-mono text-black dark:text-white font-extrabold">
                          {fmtGbp(y.grossRevenue)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-black">+29.8%</td>
                    </tr>

                    {/* Cost Structure */}
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/30 font-semibold">
                      <td className="py-2 px-3 text-foreground" colSpan={7}>
                        3. Operating Expenses Structure
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Direct Services OpEx (£132/wk base)</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {fmtGbp(y.directOperatingCosts)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono">+13.6% (Inflation)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Revenue-Linked Costs & Agency Fees</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {fmtGbp(y.revenueLinkedCosts)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono text-emerald-600">-3.0% Take Rate</td>
                    </tr>
                    <tr className="font-semibold text-muted-foreground">
                      <td className="py-2 px-3">Total Operating Expenses</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono">
                          {fmtGbp(y.totalOperatingCosts)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono">+10.7%</td>
                    </tr>

                    {/* EBITDA / Net Operating Income */}
                    <tr className="bg-emerald-500/10 font-bold border-t-2 border-emerald-500/20 text-emerald-950 dark:text-emerald-200">
                      <td className="py-3 px-3 text-emerald-900 dark:text-emerald-300 font-extrabold flex items-center gap-1.5">
                        <Flame className="h-4 w-4 text-emerald-600" />
                        EBITDA / Net Operating Income (NOI)
                      </td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black text-sm">
                          {fmtGbp(y.ebitda)}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">
                        +{pHighlights.fiveYearEbitdaCagrPct}% CAGR
                      </td>
                    </tr>
                    <tr className="bg-emerald-500/5 font-semibold text-emerald-800 dark:text-emerald-400">
                      <td className="py-2 px-3 pl-6">EBITDA Margin (%)</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono font-bold">
                          {y.ebitdaMarginPct.toFixed(1)}%
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold">+4.6% Margin Expansion</td>
                    </tr>

                    {/* Valuation & Capital Performance */}
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/30 font-semibold">
                      <td className="py-2 px-3 text-foreground" colSpan={7}>
                        4. Institutional Valuation & Capital Returns
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Annualized Revenue per Key</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono font-medium">
                          {fmtGbp(y.annualizedRevPerKey)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+22.2%</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 pl-6 text-muted-foreground">Annualized EBITDA per Key</td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-2 px-3 text-right font-mono font-medium text-emerald-600">
                          {fmtGbp(y.annualizedEbitdaPerKey)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">+30.4%</td>
                    </tr>
                    <tr className="bg-black text-white font-bold">
                      <td className="py-3 px-3 text-white font-extrabold flex items-center gap-1.5">
                        <Crown className="h-4 w-4 text-amber-400" />
                        Implied Gross Asset Valuation (@ 5.25% Cap)
                      </td>
                      {predictiveModel.fiveYearForecast.map((y) => (
                        <td key={y.year} className="py-3 px-3 text-right font-mono text-white font-black text-sm">
                          {fmtGbp(y.assetValuationAt525Cap)}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right font-mono text-amber-400 font-black">
                        +{fmtGbp(pHighlights.equityValueCreatedGbp)} Equity
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Strategic Value-Add Levers Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-black dark:text-white" />
                  Strategic Value-Add Levers & Profit Catalysts
                </h3>
                <p className="text-xs text-muted-foreground">
                  Concrete operational actions that drive the predictive margin expansion from 68.8% to 73.4%
                </p>
              </div>
              <Badge className="bg-black text-white dark:bg-white dark:text-black text-xs font-mono">
                +£943,000 Total Annual EBITDA Uplift
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictiveModel.valueAddLevers.map((lever) => (
                <Card key={lever.title} className="p-4 border-black/15 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {lever.category}
                      </Badge>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          +{fmtGbp(lever.annualImpactGbp)}/yr
                        </span>
                        <div className="text-[9px] text-muted-foreground font-mono">
                          +{lever.marginImpactPct}% margin
                        </div>
                      </div>
                    </div>
                    <h4 className="text-xs font-extrabold text-foreground leading-snug">
                      {lever.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {lever.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t text-[10px] text-muted-foreground flex items-center justify-between font-mono">
                    <span>Timeline:</span>
                    <span className="font-semibold text-foreground">{lever.implementationTimeline}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: FIFTY ONE LONDON ASSET INVENTORY & PRICING             */}
      {/* ============================================================= */}
      {activeTab === "fifty_one" && (
        <div className="space-y-6">
          {/* Executive Asset Summary */}
          <Card className="border-black/15 bg-zinc-50 dark:bg-zinc-900/50">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-black" />
                    Fifty One London — 120 Keys Baseline Asset Underwriting
                  </CardTitle>
                  <CardDescription>
                    All-inclusive long-let student living asset · 51-55 Cromwell Road, South Kensington SW7
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-black text-white dark:bg-white dark:text-black text-xs font-mono font-bold">
                    120 Keys Portfolio
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono font-semibold">
                    95% Base Occupancy
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Lettable Priced Keys</span>
                  <div className="font-extrabold text-foreground text-base">
                    118 Keys <span className="text-xs text-muted-foreground font-normal">(+2 sold-out)</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Academic Year Rent</span>
                  <div className="font-extrabold text-black dark:text-white text-base">
                    {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Direct Service OpEx</span>
                  <div className="font-extrabold text-foreground text-base">
                    {fmtGbp(fiftyOneModel.financialSummary.directOperatingCosts)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Net Operating Income (NOI)</span>
                  <div className="font-extrabold text-emerald-600 text-base">
                    {fmtGbp(fiftyOneModel.financialSummary.netOperatingIncome)}{" "}
                    <span className="text-xs font-semibold">({fiftyOneModel.financialSummary.noiMarginPct.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rooms Rates & Inventory Detail Table */}
          <Card className="border-black/15">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bed className="h-4 w-4 text-black" />
                    Room Tiers, Dimensions & Contract Pricing
                  </CardTitle>
                  <CardDescription>
                    All 8 priced room types and unpriced Superior Studios from source Checklist fifty one.xlsx
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Room Type</th>
                      <th className="py-2.5 px-2 text-center">Keys</th>
                      <th className="py-2.5 px-3 text-right">44-Wk Rate</th>
                      <th className="py-2.5 px-3 text-right">51-Wk Rate</th>
                      <th className="py-2.5 px-3 text-right">Weighted/Key</th>
                      <th className="py-2.5 px-3 text-right">Full Rev (100%)</th>
                      <th className="py-2.5 px-3 text-right">Model Rev (95%)</th>
                      <th className="py-2.5 px-2 text-center">Share</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Highlights</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fiftyOneModel.roomTypes.map((rt) => (
                      <tr key={rt.name} className={`hover:bg-muted/30 ${rt.isSoldOut ? "opacity-60 bg-muted/20" : ""}`}>
                        <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                          {rt.name}
                          {rt.view && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 bg-sky-500/10 text-sky-600 border-sky-500/20">
                              Museum View
                            </Badge>
                          )}
                          {rt.isSoldOut && (
                            <Badge variant="destructive" className="text-[9px] py-0 px-1">
                              SOLD OUT
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">{rt.keys}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {rt.rate44Week > 0 ? `£${rt.rate44Week}/wk` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {rt.rate51Week > 0 ? `£${rt.rate51Week}/wk` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          {rt.weightedAnnualRentPerKey > 0 ? fmtGbp(rt.weightedAnnualRentPerKey) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {rt.fullOccupancyRevenue > 0 ? fmtGbp(rt.fullOccupancyRevenue) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-foreground">
                          {rt.modelOccupancyRevenue > 0 ? fmtGbp(rt.modelOccupancyRevenue) : "£0"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {rt.shareOfRevenuePct > 0 ? `${rt.shareOfRevenuePct.toFixed(1)}%` : "0%"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{rt.sizeM2}</td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate" title={rt.description}>
                          {rt.description}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold border-t-2">
                      <td className="py-3 px-3 text-foreground">Total (120 Keys Portfolio)</td>
                      <td className="py-3 px-2 text-center font-mono">{fiftyOneModel.assumptions.totalKeys}</td>
                      <td className="py-3 px-3 text-right font-mono">—</td>
                      <td className="py-3 px-3 text-right font-mono">—</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {fmtGbp(fiftyOneModel.financialSummary.annualisedRevenuePerKey)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                        {fmtGbp(fiftyOneModel.financialSummary.grossRevenueFullOccupancy)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-black dark:text-white text-sm font-black">
                        {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)}
                      </td>
                      <td className="py-3 px-2 text-center font-mono">100.0%</td>
                      <td className="py-3 px-3" colSpan={2}>
                        118 priced units · 95% occupancy baseline
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payment Schedule & Cash Inflows Card */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-black/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  Instalment Payment Schedule (Cash Inflows)
                </CardTitle>
                <CardDescription>
                  Contract collection dates based on source 4-instalment schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Instalment</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-2 text-center">Share</th>
                      <th className="py-2.5 px-3 text-right">Cash Inflow</th>
                      <th className="py-2.5 px-3 text-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fiftyOneModel.paymentSchedule.map((p) => (
                      <tr key={p.instalment} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground">{p.instalment}</td>
                        <td className="py-2.5 px-3 font-mono">{p.paymentDate}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-black dark:text-white">
                          {(p.share * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {fmtGbp(p.totalInflow)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">
                          {fmtGbp(p.cumulativeInflow)}{" "}
                          <span className="text-[10px] text-muted-foreground font-normal">({p.cumulativePct}%)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-black/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-black" />
                  Direct Operating Services (£132 / key / week)
                </CardTitle>
                <CardDescription>
                  Accrues over 51 weeks on all leased units (£754,657 direct total)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Cost Line</th>
                      <th className="py-2.5 px-3 text-right">Rate / Key / Wk</th>
                      <th className="py-2.5 px-3 text-right">Annual Cost</th>
                      <th className="py-2.5 px-3">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {FIFTY_ONE_DIRECT_COSTS.map((dc) => {
                      const annualCost =
                        dc.costPerKeyWeek * fiftyOneModel.assumptions.leasedKeys * fiftyOneModel.assumptions.contract51Weeks;
                      return (
                        <tr key={dc.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium text-foreground">{dc.name}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">£{dc.costPerKeyWeek}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-muted-foreground">
                            {fmtGbp(annualCost)}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">{dc.notes}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold border-t">
                      <td className="py-2.5 px-3 text-foreground">Total Direct Services</td>
                      <td className="py-2.5 px-3 text-right font-mono text-black dark:text-white font-bold">
                        £{fiftyOneModel.assumptions.weeklyDirectCostPerKey} / wk
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-black dark:text-white font-bold">
                        {fmtGbp(fiftyOneModel.financialSummary.directOperatingCosts)}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">9 service lines</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: 30 ALL-INCLUSIVE SERVICES CATALOG                      */}
      {/* ============================================================= */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <Card className="border-black/15">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-black dark:text-white" />
                    30 All-Inclusive Building Services & Cost Mapping
                  </CardTitle>
                  <CardDescription>
                    Complete mapping from source Services.pdf to P&L operating cost lines
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={serviceFilter === "all" ? "default" : "outline"}
                    onClick={() => setServiceFilter("all")}
                    className="text-xs h-7"
                  >
                    All (30)
                  </Button>
                  <Button
                    size="sm"
                    variant={serviceFilter === "all_inclusive" ? "default" : "outline"}
                    onClick={() => setServiceFilter("all_inclusive")}
                    className="text-xs h-7"
                  >
                    Included in OpEx (21)
                  </Button>
                  <Button
                    size="sm"
                    variant={serviceFilter === "partner_perk" ? "default" : "outline"}
                    onClick={() => setServiceFilter("partner_perk")}
                    className="text-xs h-7"
                  >
                    Partner Perks (9)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3 text-center">#</th>
                      <th className="py-2.5 px-4">Service Name</th>
                      <th className="py-2.5 px-3">Resident Fee</th>
                      <th className="py-2.5 px-4">P&L Cost Line</th>
                      <th className="py-2.5 px-3 text-center">In OpEx?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredServices.map((s) => (
                      <tr key={s.no} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">{s.no}</td>
                        <td className="py-2.5 px-4 font-semibold text-foreground flex items-center gap-2">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={s.extraFee.toLowerCase().includes("free") ? "outline" : "secondary"}
                            className="text-[10px] py-0"
                          >
                            {s.extraFee}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground font-mono">{s.costLine}</td>
                        <td className="py-2.5 px-3 text-center">
                          {s.includedInOpEx ? (
                            <Badge className="bg-black text-white dark:bg-white dark:text-black text-[9px] py-0">
                              Yes
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: SERVICED OPERATING PORTFOLIO (12 UNITS)               */}
      {/* ============================================================= */}
      {activeTab === "portfolio" && (
        <div className="space-y-6">
          <Card className="border-black/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-black" />
                Audited 12-Property Serviced Apartment Portfolio Performance
              </CardTitle>
              <CardDescription>
                Short-stay operating portfolio across London & Europe with detailed property-level revenue, rent, and owner distributions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-900 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-4">Property</th>
                      <th className="py-2.5 px-2 text-center">Units</th>
                      <th className="py-2.5 px-2 text-center">Bookings</th>
                      <th className="py-2.5 px-2 text-center">Nights</th>
                      <th className="py-2.5 px-3 text-right">Gross Rev</th>
                      <th className="py-2.5 px-3 text-right">Rent</th>
                      <th className="py-2.5 px-3 text-right">Commission</th>
                      <th className="py-2.5 px-3 text-right">Net Owner Balance</th>
                      <th className="py-2.5 px-3 text-right">ADR</th>
                      <th className="py-2.5 px-2 text-center">ALOS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {portfolioData?.properties.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          {p.name} <span className="text-[10px] text-muted-foreground font-normal font-mono">({p.code})</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{p.units}</td>
                        <td className="py-2.5 px-2 text-center font-mono">{p.bookings}</td>
                        <td className="py-2.5 px-2 text-center font-mono">{p.nights}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          £{p.grossRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          £{p.rent.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-600">
                          £{p.agencyCommission.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                          £{p.ownerBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">£{p.adr.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-center font-mono">{p.alos} n</td>
                      </tr>
                    ))}
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
