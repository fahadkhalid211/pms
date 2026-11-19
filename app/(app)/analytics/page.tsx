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
  SlidersHorizontal,
  FileSpreadsheet,
  ShieldCheck,
  Zap,
  Calculator,
  Bed,
  MapPin,
  Clock,
  Landmark,
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

interface VipGuest {
  id: string;
  name: string;
  email: string | null;
  stays: number;
  nights: number;
  totalSpent: number;
  channel: string;
  loyaltyTier: string;
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
  monthly: MonthlyProgression[];
  guests: {
    totalGuests: number;
    repeatGuestsCount: number;
    singleStayCount: number;
    repeatRatePct: number;
    totalGuestSpent: number;
    avgSpendPerGuest: number;
    topGuests: VipGuest[];
    groupSizes: {
      soloCount: number;
      couplesCount: number;
      groupCount: number;
    };
  };
}

interface ConsolidatedData {
  groupGrossRevenueGbp: number;
  groupNoiGbp: number;
  groupNoiMarginPct: number;
  totalKeysUnderManagement: number;
  enterpriseValuationGbp: number;
  propertiesCount: number;
  cashCollectedGbp: number;
  weightedOccupancyPct: number;
}

type MainTabKey =
  | "fifty_one"
  | "simulator"
  | "investor_deck"
  | "portfolio"
  | "properties"
  | "services";

const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<MainTabKey>("fifty_one");
  const [isMounted, setIsMounted] = React.useState(false);

  // Simulation Sliders State
  const [simOccupancy, setSimOccupancy] = React.useState<number>(95);
  const [simContract51, setSimContract51] = React.useState<number>(70);
  const [simWeeklyCost, setSimWeeklyCost] = React.useState<number>(132);
  const [simCapRate, setSimCapRate] = React.useState<number>(5.25);

  // Data
  const [portfolioData, setPortfolioData] = React.useState<PortfolioAnalyticsData | null>(null);
  const [consolidatedData, setConsolidatedData] = React.useState<ConsolidatedData | null>(null);
  const [fiftyOneModel, setFiftyOneModel] = React.useState<FiftyOneSimulationResult>(() =>
    calculateFiftyOneModel({
      occupancyPct: 0.95,
      contract51Share: 0.70,
      weeklyDirectCostPerKey: 132,
      capRatePct: 0.0525,
    })
  );

  // Filter for services catalog
  const [serviceFilter, setServiceFilter] = React.useState<"all" | "all_inclusive" | "partner_perk">("all");

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Recalculate model whenever simulation params change
  React.useEffect(() => {
    const updated = calculateFiftyOneModel({
      occupancyPct: simOccupancy / 100,
      contract51Share: simContract51 / 100,
      weeklyDirectCostPerKey: simWeeklyCost,
      capRatePct: simCapRate / 100,
    });
    setFiftyOneModel(updated);
  }, [simOccupancy, simContract51, simWeeklyCost, simCapRate]);

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/summary");
      const json = await res.json();
      if (res.ok && json.success) {
        if (json.data?.portfolio) setPortfolioData(json.data.portfolio);
        else if (json.data?.financials) setPortfolioData(json.data);

        if (json.data?.fiftyOneLondon) {
          setFiftyOneModel(json.data.fiftyOneLondon);
        }
        if (json.data?.consolidated) {
          setConsolidatedData(json.data.consolidated);
        }
      }
    } catch {
      toast({
        title: "Note",
        description: "Operating with local audited portfolio & Fifty One London model.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export full financial model as CSV
  const handleExportCSV = () => {
    try {
      const lines: string[] = [
        "Fifty One London — 2025/26 Long-Let PBSA Financial Model",
        "Property: 51-55 Cromwell Road South Kensington London SW7 2EH",
        "Operator: The Penthouse Living (TPL)",
        `Generated on: ${new Date().toISOString()}`,
        "",
        "--- KEY ASSUMPTIONS ---",
        `Total Keys: ${fiftyOneModel.assumptions.totalKeys}`,
        `Lettable Priced Keys: ${fiftyOneModel.assumptions.lettablePricedKeys}`,
        `Model Occupancy: ${fiftyOneModel.assumptions.occupancyPct}%`,
        `Leased Keys: ${fiftyOneModel.assumptions.leasedKeys}`,
        `51-Week Contract Share: ${fiftyOneModel.assumptions.contract51Share}%`,
        `44-Week Contract Share: ${fiftyOneModel.assumptions.contract44Share}%`,
        `Direct Cost per Key per Week: £${fiftyOneModel.assumptions.weeklyDirectCostPerKey}`,
        `Revenue-Linked Costs Rate: ${fiftyOneModel.assumptions.revenueLinkedRatePct}%`,
        `Exit Cap Rate: ${fiftyOneModel.assumptions.capRatePct}%`,
        "",
        "--- FINANCIAL SUMMARY (2025/26) ---",
        `Gross Revenue (Full 100%): £${fiftyOneModel.financialSummary.grossRevenueFullOccupancy.toFixed(2)}`,
        `Gross Revenue (${fiftyOneModel.assumptions.occupancyPct}% Occ): £${fiftyOneModel.financialSummary.grossRevenueAtOccupancy.toFixed(2)}`,
        `Direct Operating Costs: £${fiftyOneModel.financialSummary.directOperatingCosts.toFixed(2)}`,
        `Revenue-Linked Costs: £${fiftyOneModel.financialSummary.revenueLinkedCosts.toFixed(2)}`,
        `Total Operating Costs: £${fiftyOneModel.financialSummary.totalOperatingCosts.toFixed(2)}`,
        `Net Operating Income (NOI): £${fiftyOneModel.financialSummary.netOperatingIncome.toFixed(2)}`,
        `NOI Margin: ${fiftyOneModel.financialSummary.noiMarginPct.toFixed(2)}%`,
        `Gross Operating Profit (GOP): £${fiftyOneModel.financialSummary.gop.toFixed(2)}`,
        `GOP Margin: ${fiftyOneModel.financialSummary.gopMarginPct.toFixed(2)}%`,
        `Annualised Revenue / Leased Key: £${fiftyOneModel.financialSummary.annualisedRevenuePerKey.toFixed(2)}`,
        `Annualised NOI / Leased Key: £${fiftyOneModel.financialSummary.annualisedNoiPerKey.toFixed(2)}`,
        `Estimated Asset Valuation: £${fiftyOneModel.financialSummary.estimatedValuation.toFixed(2)}`,
        "",
        "--- ROOM TYPES & INVENTORY ---",
        "Room Type,Keys,44-Wk Rate (£/wk),51-Wk Rate (£/wk),Weighted Rent/Key/Yr (£),Revenue @ 100% (£),Model Revenue (£),Revenue Share (%),Size,Description",
        ...fiftyOneModel.roomTypes.map(
          (rt) =>
            `"${rt.name}",${rt.keys},${rt.rate44Week},${rt.rate51Week},${rt.weightedAnnualRentPerKey.toFixed(2)},${rt.fullOccupancyRevenue.toFixed(2)},${rt.modelOccupancyRevenue.toFixed(2)},${rt.shareOfRevenuePct}%,${rt.sizeM2},"${rt.description}"`
        ),
        "",
        "--- MONTHLY P&L (ACADEMIC YEAR 2025/26) ---",
        "Month,Weeks (51),Weeks (44),Revenue (£),Direct Costs (£),Revenue-Linked (£),Total OpEx (£),GOP (£),NOI (£),NOI Margin (%)",
        ...fiftyOneModel.monthlyPnl.map(
          (m) =>
            `${m.label},${m.billableWeeks51},${m.billableWeeks44},${m.totalRevenue.toFixed(2)},${m.directCosts.toFixed(2)},${m.revenueLinkedCosts.toFixed(2)},${m.totalOpCosts.toFixed(2)},${m.gop.toFixed(2)},${m.noi.toFixed(2)},${m.noiMarginPct}%`
        ),
        "",
        "--- PAYMENT SCHEDULE (CASH INFLOWS) ---",
        "Instalment,Payment Date,Share (%),Total Cash Inflow (£),Cumulative Inflow (£),Cumulative (%)",
        ...fiftyOneModel.paymentSchedule.map(
          (p) =>
            `"${p.instalment}",${p.paymentDate},${p.share * 100}%,${p.totalInflow.toFixed(2)},${p.cumulativeInflow.toFixed(2)},${p.cumulativePct}%`
        ),
        "",
        "--- OCCUPANCY SCENARIOS ---",
        "Scenario,Occupancy (%),Leased Keys,Rent Revenue (£),Total OpEx (£),NOI (£),NOI Margin (%),NOI / Key (£)",
        ...fiftyOneModel.scenarios.map(
          (s) =>
            `"${s.label}",${s.occupancyPct}%,${s.leasedKeys},${s.rentRevenue.toFixed(2)},${s.totalOpCosts.toFixed(2)},${s.noi.toFixed(2)},${s.noiMarginPct}%,${s.noiPerKey.toFixed(2)}`
        ),
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Fifty_One_London_Financial_Model_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Export Completed",
        description: "Fifty One London complete financial model exported to CSV.",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err?.message || "Failed to generate CSV export",
        variant: "destructive",
      });
    }
  };

  // Helper formatting
  const fmtGbp = (n: number) =>
    `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const filteredServices = React.useMemo(() => {
    if (serviceFilter === "all") return FIFTY_ONE_SERVICES;
    return FIFTY_ONE_SERVICES.filter((s) => s.category === serviceFilter);
  }, [serviceFilter]);

  // Chart Data Preparation
  const roomRevenueChartData = React.useMemo(() => {
    return fiftyOneModel.roomTypes
      .filter((rt) => !rt.isSoldOut && rt.modelOccupancyRevenue > 0)
      .map((rt) => ({
        name: rt.name.replace("Studio", "Std").replace("Mezzanine", "Mezz"),
        fullName: rt.name,
        keys: rt.keys,
        revenue: Math.round(rt.modelOccupancyRevenue),
        share: rt.shareOfRevenuePct,
        weeklyRent: Math.round(rt.weightedAnnualRentPerKey / (0.7 * 51 + 0.3 * 44)),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [fiftyOneModel]);

  const costBreakdownChartData = React.useMemo(() => {
    const directTotal = fiftyOneModel.financialSummary.directOperatingCosts;
    const revLinkedTotal = fiftyOneModel.financialSummary.revenueLinkedCosts;
    const directItems = FIFTY_ONE_DIRECT_COSTS.map((dc) => ({
      name: dc.name,
      value: Math.round((dc.costPerKeyWeek / 132) * directTotal),
      category: "Direct Services",
    }));

    const revItems = FIFTY_ONE_REVENUE_COSTS.map((rc) => ({
      name: rc.name,
      value: Math.round((rc.percent / 0.185) * revLinkedTotal),
      category: "Revenue-Linked",
    }));

    return [...directItems, ...revItems];
  }, [fiftyOneModel]);

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* Top Banner & Header */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Landmark className="h-7 w-7 text-primary" />
              Lumina Strategic Analytics & Investor Portal
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold">
              Institutional PBSA + Serviced Portfolio
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Fifty One London · 51-55 Cromwell Road, South Kensington SW7 · Managed by The Penthouse Living (TPL)
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Model CSV
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              toast({
                title: "Report Refreshed",
                description: "Audited model metrics and database synchronized.",
              });
              fetchAnalytics();
            }}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Group Consolidated Metrics Bar (Executive Summary) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5 text-primary" /> Fifty One Gross
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground mt-1">
            {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {fiftyOneModel.assumptions.occupancyPct}% occupancy ({fiftyOneModel.assumptions.leasedKeys} keys)
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-card to-emerald-500/5 border-emerald-500/20 shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Net Operating Income
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {fmtGbp(fiftyOneModel.financialSummary.netOperatingIncome)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            NOI Margin: <span className="font-bold text-emerald-600">{fiftyOneModel.financialSummary.noiMarginPct.toFixed(1)}%</span>
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-card to-sky-500/5 border-sky-500/20 shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <PiggyBank className="h-3.5 w-3.5 text-sky-600" /> Asset Valuation
          </div>
          <div className="text-xl md:text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
            {fmtGbp(fiftyOneModel.financialSummary.estimatedValuation)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Yield basis: <span className="font-semibold">{fiftyOneModel.assumptions.capRatePct.toFixed(2)}% Cap</span>
          </div>
        </Card>

        <Card className="p-3 bg-card border-border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Bed className="h-3.5 w-3.5 text-indigo-600" /> Total Keys
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground mt-1">
            {fiftyOneModel.assumptions.totalKeys} Keys
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            118 priced · 2 Superior sold-out
          </div>
        </Card>

        <Card className="p-3 bg-card border-border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-amber-600" /> Annual Rev / Key
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground mt-1">
            {fmtGbp(fiftyOneModel.financialSummary.annualisedRevenuePerKey)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            NOI/Key: {fmtGbp(fiftyOneModel.financialSummary.annualisedNoiPerKey)}
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-card to-purple-500/5 border-purple-500/20 shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Crown className="h-3.5 w-3.5 text-purple-600" /> Group Portfolio
          </div>
          <div className="text-xl md:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {fmtGbp(
              (consolidatedData?.groupGrossRevenueGbp || 6265634 + 313000)
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            136 Units under management
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Navigation Tabs */}
      {/* ------------------------------------------------------------- */}
      <div className="flex border-b border-border text-sm overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("fifty_one")}
          className={`px-4 py-2.5 font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "fifty_one"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Landmark className="h-4 w-4" />
          Fifty One London Model (120 Keys)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("simulator")}
          className={`px-4 py-2.5 font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "simulator"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
          Predict & Plan Simulator
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600">
            Live
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("investor_deck")}
          className={`px-4 py-2.5 font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "investor_deck"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <PiggyBank className="h-4 w-4 text-sky-600" />
          Investor Pitch Deck & Valuation
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("services")}
          className={`px-4 py-2.5 font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "services"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          30 All-Inclusive Services Catalog
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("portfolio")}
          className={`px-4 py-2.5 font-medium border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === "portfolio"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Short-Stay Serviced Portfolio (12 Units)
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: FIFTY ONE LONDON 2025/26 MODEL                         */}
      {/* ============================================================= */}
      {activeTab === "fifty_one" && (
        <div className="space-y-6">
          {/* Executive Asset Card */}
          <Card className="bg-muted/30 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Fifty One London — Prime South Kensington PBSA Model (2025/26)
                  </CardTitle>
                  <CardDescription>
                    Long-let luxury student accommodation asset · Academic year: 06 Sep 2025 → 28 Aug 2026 (51 weeks) / 10 Jul 2026 (44 weeks)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Base Case: 95% Occupancy
                  </Badge>
                  <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/20">
                    70/30 Contract Split
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Lettable Priced Keys</span>
                  <div className="font-bold text-foreground text-base">
                    118 Keys <span className="text-xs text-muted-foreground font-normal">(+2 sold out)</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Gross Invoiced Rent (95%)</span>
                  <div className="font-bold text-primary text-base">
                    {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Direct Operating Costs (£132/wk)</span>
                  <div className="font-bold text-foreground text-base">
                    {fmtGbp(fiftyOneModel.financialSummary.directOperatingCosts)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Net Operating Income (NOI)</span>
                  <div className="font-bold text-emerald-600 text-base">
                    {fmtGbp(fiftyOneModel.financialSummary.netOperatingIncome)}{" "}
                    <span className="text-xs font-semibold">({fiftyOneModel.financialSummary.noiMarginPct.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Row: Revenue by Room Type + Operating Cost Structure */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Chart 1: Revenue by Room Type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-primary" />
                    Revenue by Room Type (Academic Year)
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)} Total
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Contribution per room tier based on 70% 51-week & 30% 44-week blend
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full pt-2">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={roomRevenueChartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis type="number" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip
                          formatter={(value: any) => [fmtGbp(Number(value)), "Revenue"]}
                          labelFormatter={(label: any) => `Room: ${label}`}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                          {roomRevenueChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Rendering chart...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: OpEx Cost Structure Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-amber-500" />
                    All-Bills Operating Cost Structure
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {fmtGbp(fiftyOneModel.financialSummary.totalOperatingCosts)} Total OpEx
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Direct all-inclusive building services (£132/key/wk) + revenue-linked management fees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full pt-2">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costBreakdownChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={95}
                          innerRadius={55}
                          paddingAngle={2}
                        >
                          {costBreakdownChartData.map((_, index) => (
                            <Cell key={`cost-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [fmtGbp(Number(value)), "Annual Cost"]} />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                        />
                      </PieChart>
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

          {/* Rooms Rates & Inventory Detail Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bed className="h-4 w-4 text-primary" />
                    Rooms Rates, Inventory & Contract Pricing (120 Keys)
                  </CardTitle>
                  <CardDescription>
                    Complete room inventory extracted directly from Checklist fifty one.xlsx
                  </CardDescription>
                </div>
                <div className="text-xs text-muted-foreground">
                  *Unpriced Superior Studio is sold out in source and excluded from baseline revenue
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Room Type</th>
                      <th className="py-2.5 px-2 text-center">Keys</th>
                      <th className="py-2.5 px-3 text-right">44-Wk Rate</th>
                      <th className="py-2.5 px-3 text-right">51-Wk Rate</th>
                      <th className="py-2.5 px-3 text-right">Weighted/Key</th>
                      <th className="py-2.5 px-3 text-right">Gross Rev (100%)</th>
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
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-primary">
                          {rt.rate51Week > 0 ? `£${rt.rate51Week}/wk` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          {rt.weightedAnnualRentPerKey > 0 ? fmtGbp(rt.weightedAnnualRentPerKey) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {rt.fullOccupancyRevenue > 0 ? fmtGbp(rt.fullOccupancyRevenue) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
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
                    {/* Total Row */}
                    <tr className="bg-muted/70 font-bold border-t-2">
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
                      <td className="py-3 px-3 text-right font-mono text-primary text-sm">
                        {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)}
                      </td>
                      <td className="py-3 px-2 text-center font-mono">100.0%</td>
                      <td className="py-3 px-3" colSpan={2}>
                        118 priced units · 95% occupancy base case
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payment Schedule & Cash Inflows Card */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  Instalment Payment Schedule & Cash Flow Timing
                </CardTitle>
                <CardDescription>
                  Contract collection dates based on source 4-instalment schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
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
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-primary">
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

            {/* Direct Services Breakdown Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Direct Operating Services (£132 / key / week)
                </CardTitle>
                <CardDescription>
                  Accrues over 51 weeks on all leased units (£754,657 direct total)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
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
                          <td className="py-2 px-3 text-right font-mono font-semibold">£{dc.costPerKeyWeek}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-muted-foreground">
                            {fmtGbp(annualCost)}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">{dc.notes}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/70 font-bold border-t">
                      <td className="py-2.5 px-3 text-foreground">Total Direct Services</td>
                      <td className="py-2.5 px-3 text-right font-mono text-primary font-bold">
                        £{fiftyOneModel.assumptions.weeklyDirectCostPerKey} / wk
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-primary font-bold">
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
      {/* TAB 2: PREDICT & PLAN SIMULATOR                               */}
      {/* ============================================================= */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <Card className="border-emerald-500/30 bg-gradient-to-r from-card to-emerald-500/5">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
                    Interactive "Predict & Plan" Financial Sandbox
                  </CardTitle>
                  <CardDescription>
                    Dynamically stress-test Fifty One London occupancy, contract durations, OpEx inflation, and capital yields
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSimOccupancy(95);
                    setSimContract51(70);
                    setSimWeeklyCost(132);
                    setSimCapRate(5.25);
                    toast({ title: "Reset", description: "Default institutional parameters restored." });
                  }}
                  className="text-xs"
                >
                  Reset Defaults
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
                {/* Slider 1: Occupancy */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Occupancy Rate</span>
                    <Badge variant="outline" className="font-mono text-primary font-bold">
                      {simOccupancy}% ({Math.round(118 * (simOccupancy / 100) * 10) / 10} keys)
                    </Badge>
                  </div>
                  <input
                    type="range"
                    min="75"
                    max="100"
                    step="1"
                    value={simOccupancy}
                    onChange={(e) => setSimOccupancy(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>75% (Stress)</span>
                    <span>95% (Base)</span>
                    <span>100% (Ceiling)</span>
                  </div>
                </div>

                {/* Slider 2: 51-Week Contract Mix */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">51-Wk Contract Mix</span>
                    <Badge variant="outline" className="font-mono text-sky-600 font-bold">
                      {simContract51}% / {100 - simContract51}% 44-wk
                    </Badge>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="95"
                    step="5"
                    value={simContract51}
                    onChange={(e) => setSimContract51(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>40% (More 44w)</span>
                    <span>70% (Base)</span>
                    <span>95% (All 51w)</span>
                  </div>
                </div>

                {/* Slider 3: OpEx per key per week */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Weekly OpEx / Key</span>
                    <Badge variant="outline" className="font-mono text-amber-600 font-bold">
                      £{simWeeklyCost} / key / wk
                    </Badge>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="180"
                    step="2"
                    value={simWeeklyCost}
                    onChange={(e) => setSimWeeklyCost(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>£100 (Lean)</span>
                    <span>£132 (Standard)</span>
                    <span>£180 (High-Spec)</span>
                  </div>
                </div>

                {/* Slider 4: Exit Cap Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Target Cap Rate (Yield)</span>
                    <Badge variant="outline" className="font-mono text-emerald-600 font-bold">
                      {simCapRate.toFixed(2)}%
                    </Badge>
                  </div>
                  <input
                    type="range"
                    min="4.50"
                    max="6.50"
                    step="0.25"
                    value={simCapRate}
                    onChange={(e) => setSimCapRate(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>4.50% (Prime SW7)</span>
                    <span>5.25% (PBSA Base)</span>
                    <span>6.50% (Conservative)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real-Time Simulated Outcomes Card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 border-primary/20">
              <span className="text-xs text-muted-foreground">Simulated Gross Revenue</span>
              <div className="text-2xl font-black text-primary mt-1">
                {fmtGbp(fiftyOneModel.financialSummary.grossRevenueAtOccupancy)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                51-Wk: {fmtGbp(fiftyOneModel.financialSummary.revenue51WeekPortion)} · 44-Wk:{" "}
                {fmtGbp(fiftyOneModel.financialSummary.revenue44WeekPortion)}
              </div>
            </Card>

            <Card className="p-4 border-amber-500/20">
              <span className="text-xs text-muted-foreground">Total Operating Costs</span>
              <div className="text-2xl font-black text-foreground mt-1">
                {fmtGbp(fiftyOneModel.financialSummary.totalOperatingCosts)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Direct: {fmtGbp(fiftyOneModel.financialSummary.directOperatingCosts)} · Variable:{" "}
                {fmtGbp(fiftyOneModel.financialSummary.revenueLinkedCosts)}
              </div>
            </Card>

            <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
              <span className="text-xs text-muted-foreground">Simulated NOI</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {fmtGbp(fiftyOneModel.financialSummary.netOperatingIncome)}
              </div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                NOI Margin: {fiftyOneModel.financialSummary.noiMarginPct.toFixed(1)}%
              </div>
            </Card>

            <Card className="p-4 border-sky-500/20 bg-sky-500/5">
              <span className="text-xs text-muted-foreground">Implied Asset Valuation</span>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
                {fmtGbp(fiftyOneModel.financialSummary.estimatedValuation)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                £{Math.round(fiftyOneModel.financialSummary.estimatedValuation / 120).toLocaleString("en-GB")}{" "}
                per key (120 units)
              </div>
            </Card>
          </div>

          {/* Scenario Comparison Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Sensitivity Matrix: 4 Core Occupancy Scenarios
              </CardTitle>
              <CardDescription>
                Each 1% change in occupancy impacts gross rent by ~£62.7k and NOI by ~£51.0k
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Scenario</th>
                      <th className="py-2.5 px-3 text-center">Occupancy</th>
                      <th className="py-2.5 px-3 text-center">Leased Keys</th>
                      <th className="py-2.5 px-4 text-right">Rent Revenue</th>
                      <th className="py-2.5 px-4 text-right">Direct Costs</th>
                      <th className="py-2.5 px-4 text-right">Revenue-Linked</th>
                      <th className="py-2.5 px-4 text-right">NOI (£)</th>
                      <th className="py-2.5 px-3 text-center">NOI Margin</th>
                      <th className="py-2.5 px-4 text-right">NOI / Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fiftyOneModel.scenarios.map((sc) => {
                      const isCurrent = Math.abs(sc.occupancyPct - simOccupancy) < 0.5;
                      return (
                        <tr
                          key={sc.label}
                          className={`hover:bg-muted/30 transition ${
                            isCurrent ? "bg-primary/10 font-semibold" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                            {sc.label}
                            {isCurrent && (
                              <Badge variant="default" className="text-[9px] py-0 px-1">
                                Active Simulator
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-primary">
                            {sc.occupancyPct.toFixed(0)}%
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{sc.leasedKeys}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                            {fmtGbp(sc.rentRevenue)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {fmtGbp(sc.directOpCosts)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {fmtGbp(sc.revenueLinkedCosts)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {fmtGbp(sc.noi)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {sc.noiMarginPct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium">
                            {fmtGbp(sc.noiPerKey)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Monthly P&L Chart & Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  Monthly P&L Accrual & Net Operating Income (Sep 2025 → Aug 2026)
                </span>
                <Badge variant="outline" className="text-xs">
                  Academic Year 2025/26
                </Badge>
              </CardTitle>
              <CardDescription>
                Calendar-weighted contract revenue progression alongside all-bills direct & variable operating costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full pt-2">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={fiftyOneModel.monthlyPnl}
                      margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNoi" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: any) => [fmtGbp(Number(value)), "Amount"]} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="totalRevenue"
                        name="Gross Rent Accrued"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorRev)"
                      />
                      <Area
                        type="monotone"
                        dataKey="noi"
                        name="Net Operating Income (NOI)"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorNoi)"
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
      )}

      {/* ============================================================= */}
      {/* TAB 3: INVESTOR PITCH DECK & VALUATION                        */}
      {/* ============================================================= */}
      {activeTab === "investor_deck" && (
        <div className="space-y-6">
          {/* Pitch Header Card */}
          <Card className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-none shadow-xl">
            <CardContent className="p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500 text-white font-bold tracking-wide uppercase text-xs">
                  Investment Grade
                </Badge>
                <span className="text-xs text-slate-300">Prime London Student Living Asset</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                Fifty One London · £78.0M Implied Valuation
              </h2>
              <p className="text-slate-300 text-sm md:text-base max-w-3xl leading-relaxed">
                Super-prime student accommodation asset comprising 120 luxury studio and mezzanine suites directly opposite the Natural History Museum in South Kensington, SW7. Positioned for Imperial College London, Royal College of Music, and RCA students with all-bills inclusive hospitality amenities.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">Target Net Yield</div>
                  <div className="text-xl md:text-2xl font-bold text-white">5.25% Cap Rate</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">NOI Run-Rate</div>
                  <div className="text-xl md:text-2xl font-bold text-emerald-400">
                    {fmtGbp(fiftyOneModel.financialSummary.netOperatingIncome)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Average Weekly Rent</div>
                  <div className="text-xl md:text-2xl font-bold text-white">
                    £{Math.round(fiftyOneModel.financialSummary.weightedWeeklyRent)} / week
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Pre-Paid Cash By Jan</div>
                  <div className="text-xl md:text-2xl font-bold text-sky-400">
                    84% of Rent (£5.0M)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Institutional Cap Rate Valuation Matrix */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" />
                  Exit Cap Rate Valuation Multipliers
                </CardTitle>
                <CardDescription>
                  Market valuation sensitivity across prime London PBSA yields (4.75% – 6.00%)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Exit Cap Rate</th>
                      <th className="py-2.5 px-3 text-center">NOI Multiple</th>
                      <th className="py-2.5 px-4 text-right">Asset Valuation</th>
                      <th className="py-2.5 px-4 text-right">Price / Key (120 Keys)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fiftyOneModel.valuations.map((v) => {
                      const isBase = Math.abs(v.capRatePct - 5.25) < 0.05;
                      return (
                        <tr
                          key={v.capRatePct}
                          className={`hover:bg-muted/30 ${isBase ? "bg-emerald-500/10 font-bold" : ""}`}
                        >
                          <td className="py-2.5 px-4 font-semibold text-foreground flex items-center gap-2">
                            {v.capRatePct.toFixed(2)}%
                            {isBase && (
                              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                Prime Base
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{v.multipleOfNOI.toFixed(1)}x</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-primary">
                            {fmtGbp(v.valuation)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                            {fmtGbp(v.pricePerKey)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Valuation Sensitivity Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-600" />
                  Valuation Curve (£ Millions)
                </CardTitle>
                <CardDescription>
                  Capital value as a function of investor yield requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full pt-2">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={fiftyOneModel.valuations.map((v) => ({
                          capRate: `${v.capRatePct.toFixed(2)}%`,
                          valuationM: Math.round(v.valuation / 100000) / 10,
                        }))}
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="capRate" tick={{ fontSize: 11 }} />
                        <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `£${v}M`} />
                        <Tooltip formatter={(value: any) => [`£${value}M`, "Gross Asset Value"]} />
                        <Line
                          type="monotone"
                          dataKey="valuationM"
                          stroke="#0284c7"
                          strokeWidth={3}
                          dot={{ r: 5, fill: "#0284c7" }}
                        />
                      </LineChart>
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

          {/* Investment Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Extreme Cashflow Certainty
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                4-instalment contractual structure requires 14% cash upfront by August 4, 49% by October, and 84% by January. Eliminates standard monthly tenant credit default risks.
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-sky-500">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Crown className="h-4 w-4 text-sky-600" />
                Unrivalled South Kensington Location
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Directly opposite the Natural History Museum on Cromwell Road, walking distance to Imperial College London. Prime Tier-1 global student destination with permanent undersupply.
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Zap className="h-4 w-4 text-indigo-600" />
                Tech-Enabled Operations
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Smart room temperature controls (Utopi), 1Gbps symmetric fiber, Herman Miller ergonomic design, and automated access systems keep direct operating costs fixed at £132/key/week.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: 30 ALL-INCLUSIVE SERVICES CATALOG                      */}
      {/* ============================================================= */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    30 All-Inclusive Building Services & Operating Cost Mapping
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
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
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
                            <Badge className="bg-emerald-500 text-white text-[9px] py-0">Yes</Badge>
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
      {/* TAB 5: SHORT-STAY SERVICED PORTFOLIO (12 UNITS)               */}
      {/* ============================================================= */}
      {activeTab === "portfolio" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Audited 12-Property Serviced Apartment Portfolio Performance
              </CardTitle>
              <CardDescription>
                Short-stay operating portfolio across London & Europe with detailed property-level revenue, rent, and owner distributions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
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

          {/* Acquisition Channels Breakdown */}
          {portfolioData?.channels && portfolioData.channels.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-sky-600" />
                  Channel Distribution & Direct Booking Share
                </CardTitle>
                <CardDescription>
                  Serviced portfolio booking acquisition channels
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Channel</th>
                      <th className="py-2.5 px-3 text-center">Bookings</th>
                      <th className="py-2.5 px-3 text-center">Share Bookings</th>
                      <th className="py-2.5 px-3 text-center">Nights</th>
                      <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                      <th className="py-2.5 px-3 text-center">Share Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {portfolioData.channels.map((c) => (
                      <tr key={c.key} className="hover:bg-muted/30">
                        <td className="py-2.5 px-4 font-semibold text-foreground">{c.name}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{c.bookings}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{c.shareOfBookings.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-center font-mono">{c.nights}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                          £{c.grossRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                          {c.shareOfRevenue.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
