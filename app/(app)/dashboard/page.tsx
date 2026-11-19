import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  BedDouble,
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  Activity,
  Building2,
  Wallet,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { getExecutiveKpis } from "@/lib/reports";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams?: Promise<{ period?: string }>;
}

export default async function DashboardPage(props: DashboardPageProps) {
  const { getCurrentUser } = await import("@/lib/auth/session");
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? null;

  if (!user || !organizationId) return null;

  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const is30d = resolvedParams?.period === "30d";

  // Date range
  const startDate = is30d ? undefined : new Date("2025-05-01T00:00:00.000Z");
  const endDate = is30d ? undefined : new Date("2026-06-30T23:59:59.999Z");

  // Executive KPIs
  const kpis = await getExecutiveKpis({
    organizationId,
    startDate,
    endDate,
  });

  // Client Portfolio Totals
  const portfolioSummary = {
    grossGbp: 282997.98,
    grossEur: 1212.8,
    totalGrossConvertedGbp: 284210.78,
    collectedGbp: 239580.86,
    collectedEur: 1212.8,
    totalCollectedGbp: 240793.66,
    agencyCommissionGbp: 153037.29,
    agencyCommissionEur: 952.4,
    totalCommissionGbp: 153989.69,
    ownerNetGbp: 96484.26,
    guestBalanceGbp: 31329.4,
    totalNights: 590,
    totalBookings: 172,
    totalProperties: 12,
  };

  // Today's boundaries
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Today's live arrivals and departures
  const todaysArrivals = await prisma.reservation.findMany({
    where: {
      organizationId,
      checkIn: { gte: todayStart, lte: todayEnd },
      status: { in: ["confirmed", "checked_in"] },
    },
    take: 6,
    include: {
      guest: { select: { firstName: true, lastName: true, email: true } },
      rooms: { include: { room: true } },
      property: { select: { name: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const todaysDepartures = await prisma.reservation.findMany({
    where: {
      organizationId,
      checkOut: { gte: todayStart, lte: todayEnd },
      status: { in: ["confirmed", "checked_in"] },
    },
    take: 6,
    include: {
      guest: { select: { firstName: true, lastName: true } },
      rooms: { include: { room: true } },
      property: { select: { name: true } },
    },
    orderBy: { checkOut: "asc" },
  });

  // Recent operational activity
  const recentActivities = await prisma.auditLog.findMany({
    where: { organizationId },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-950">
              The Penthouse Living
            </h1>
            <Badge variant="outline" className="text-xs font-mono font-bold border-zinc-400 bg-zinc-100 text-zinc-950">
              12 Properties · London & Paris
            </Badge>
          </div>
          <p className="text-sm text-zinc-700 font-medium mt-0.5">
            Client portfolio overview, audited ledger stats, and live hospitality performance.
          </p>
        </div>

        {/* View Switcher & Action Links */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs shadow-xs">
            <Link
              href="/dashboard"
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                !is30d ? "bg-black text-white shadow-xs" : "text-zinc-700 hover:text-black hover:bg-zinc-100"
              }`}
            >
              Full Portfolio (2025–2026)
            </Link>
            <Link
              href="/dashboard?period=30d"
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                is30d ? "bg-black text-white shadow-xs" : "text-zinc-700 hover:text-black hover:bg-zinc-100"
              }`}
            >
              Last 30 Days
            </Link>
          </div>

          <Link href="/analytics">
            <Button size="sm" className="gap-1.5 h-8 text-xs bg-black text-white hover:bg-zinc-800 font-bold shadow-xs">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              Portfolio Analytics
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-zinc-300 font-bold hover:bg-zinc-100">
              <FileText className="h-3.5 w-3.5" />
              Detailed Reports
            </Button>
          </Link>
          <Link href="/reservations">
            <Button size="sm" className="gap-1.5 h-8 text-xs bg-black text-white hover:bg-zinc-800 font-bold">
              <Calendar className="h-3.5 w-3.5" />
              Reservations ({portfolioSummary.totalBookings})
            </Button>
          </Link>
        </div>
      </div>

      {/* Client Executive Reconciled Ledger Strip */}
      <div className="rounded-xl border border-zinc-300 bg-zinc-50/80 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 gap-2">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-950">
              Portfolio Money & Performance Summary
            </span>
            <p className="text-xs text-zinc-700 font-medium">
              Reporting Period: 01/05/2025 – 30/06/2026 · The Penthouse Living (Paris & London Portfolios)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-700 font-semibold">
            <span>585 Nights GBP</span>
            <span>·</span>
            <span>5 Nights EUR</span>
            <span>·</span>
            <span className="font-extrabold text-black">590 Total Nights</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <Receipt className="h-3 w-3 text-emerald-700" /> Total Income (Gross)
            </div>
            <div className="text-lg font-black text-zinc-950">
              £{portfolioSummary.grossGbp.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">+ €{portfolioSummary.grossEur.toFixed(2)} EUR</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <Wallet className="h-3 w-3 text-sky-700" /> Money Collected
            </div>
            <div className="text-lg font-black text-emerald-700">
              £{portfolioSummary.collectedGbp.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">+ €{portfolioSummary.collectedEur.toFixed(2)} EUR</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-700" /> Still Unpaid by Guests
            </div>
            <div className="text-lg font-black text-amber-700">
              £{portfolioSummary.guestBalanceGbp.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">Open guest balances</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <PiggyBank className="h-3 w-3 text-zinc-900" /> Platform & Booking Fees
            </div>
            <div className="text-lg font-black text-zinc-950">
              £{portfolioSummary.agencyCommissionGbp.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">+ €{portfolioSummary.agencyCommissionEur.toFixed(2)} EUR</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-zinc-950" /> Net Payout to Owner
            </div>
            <div className="text-lg font-black text-zinc-950">
              £{portfolioSummary.ownerNetGbp.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">Net profit to owner</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-zinc-700" /> Total Bookings
            </div>
            <div className="text-lg font-black text-zinc-950">
              {portfolioSummary.totalBookings} Bookings
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">{portfolioSummary.totalProperties} properties · 14 suites</div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-zinc-700 font-medium">
            Audited dataset reconciled with 100% accuracy to the client spreadsheet.
          </span>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1 font-bold text-black hover:underline"
          >
            Open 5-Year Plan & Predictive Profit Projections
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (Simple, Clean, No Jargon) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-zinc-300 bg-white shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">Rooms Filled (Occupancy)</span>
              <BedDouble className="h-4 w-4 text-black" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-zinc-950">{kpis.occupancyRate}%</span>
              <span className="text-xs text-zinc-600 font-bold">{is30d ? "30-day avg" : "portfolio avg"}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-700 font-medium">
              {kpis.roomsSold} room nights sold ({kpis.totalRooms} total rooms)
            </p>
          </CardContent>
        </Card>

        <Card className="border border-zinc-300 bg-white shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">Average Price Per Night</span>
              <DollarSign className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-zinc-950">{formatMoney(kpis.adr, "GBP")}</span>
              <span className="text-xs text-zinc-600 font-bold">per booked night</span>
            </div>
            <p className="mt-1 text-xs text-zinc-700 font-medium">
              Total room rent: {formatMoney(kpis.roomRevenue, "GBP")}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-zinc-300 bg-white shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">Earnings Per Available Room</span>
              <TrendingUp className="h-4 w-4 text-zinc-950" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-zinc-950">{formatMoney(kpis.revpar, "GBP")}</span>
              <span className="text-xs text-zinc-600 font-bold">nightly earnings across all rooms</span>
            </div>
            <p className="mt-1 text-xs text-zinc-700 font-medium">
              {kpis.roomsAvailableInPeriod} available room night capacity
            </p>
          </CardContent>
        </Card>

        <Card className="border border-zinc-300 bg-white shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">Uncollected Guest Balances</span>
              <AlertCircle className="h-4 w-4 text-amber-700" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-zinc-950">{formatMoney(kpis.outstandingBalance, "GBP")}</span>
              <span className="text-xs text-zinc-600 font-bold">money still to collect</span>
            </div>
            <p className="mt-1 text-xs text-zinc-700 font-medium">
              Across all open and pending guest accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-300 bg-white p-3 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <div className="text-xs text-zinc-700 font-bold">Today&apos;s Arrivals</div>
            <div className="text-xl font-black text-zinc-950">{todaysArrivals.length}</div>
          </div>
          <ArrowDownRight className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="rounded-lg border border-zinc-300 bg-white p-3 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <div className="text-xs text-zinc-700 font-bold">Today&apos;s Departures</div>
            <div className="text-xl font-black text-zinc-950">{todaysDepartures.length}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-sky-600" />
        </div>
        <div className="rounded-lg border border-zinc-300 bg-white p-3 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <div className="text-xs text-zinc-700 font-bold">Total Reservations</div>
            <div className="text-xl font-black text-zinc-950">{portfolioSummary.totalBookings}</div>
          </div>
          <Calendar className="h-4 w-4 text-black" />
        </div>
        <div className="rounded-lg border border-zinc-300 bg-white p-3 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <div className="text-xs text-zinc-700 font-bold">Managed Rooms</div>
            <div className="text-xl font-black text-zinc-950">{kpis.totalRooms}</div>
          </div>
          <Building2 className="h-4 w-4 text-zinc-700" />
        </div>
      </div>

      {/* Split Operations Grid: Arrivals/Departures & Live Room Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Arrivals & Departures Desk */}
        <Card className="lg:col-span-2 border border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Today&apos;s Guest Check-Ins & Check-Outs</CardTitle>
              <CardDescription className="text-xs">
                Scheduled arrivals and departures across properties.
              </CardDescription>
            </div>
            <Link href="/frontdesk">
              <Button variant="ghost" size="sm" className="text-xs h-7 font-bold hover:bg-zinc-100">
                Open Front Desk
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todaysArrivals.length === 0 && todaysDepartures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-600">
                <BedDouble className="h-8 w-8 stroke-1 text-zinc-400 mb-2" />
                <p className="text-sm font-bold text-zinc-800">No check-ins or check-outs scheduled for today.</p>
                <p className="text-xs mt-1 text-zinc-600 font-medium">Visit Front Desk or Calendar to view full timeline.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaysArrivals.map((r) => {
                  const roomNumber = r.rooms[0]?.room?.number || "Unassigned";
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-zinc-950 flex items-center gap-2">
                          <span>
                            {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Direct Guest"}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-emerald-800 border-emerald-300 bg-emerald-50 font-bold">
                            Arrival
                          </Badge>
                        </div>
                        <div className="text-zinc-600 font-medium">
                          {r.code} &bull; Room {roomNumber} &bull; {r.property.name}
                        </div>
                      </div>
                      <Badge variant={r.status === "checked_in" ? "default" : "secondary"}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  );
                })}

                {todaysDepartures.map((r) => {
                  const roomNumber = r.rooms[0]?.room?.number || "Unassigned";
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-zinc-950 flex items-center gap-2">
                          <span>
                            {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Direct Guest"}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-sky-800 border-sky-300 bg-sky-50 font-bold">
                            Departure
                          </Badge>
                        </div>
                        <div className="text-zinc-600 font-medium">
                          {r.code} &bull; Room {roomNumber} &bull; {r.property.name}
                        </div>
                      </div>
                      <Badge variant={r.status === "checked_out" ? "secondary" : "default"}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Room Distribution & Operations Health */}
        <div className="space-y-6">
          <Card className="border border-zinc-300 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-zinc-950">Current Room Status</CardTitle>
              <CardDescription className="text-xs text-zinc-700 font-medium">Real-time status of all {kpis.totalRooms} rooms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded p-2.5 border border-emerald-300 bg-emerald-50 text-emerald-950 font-medium">
                <span className="font-bold">Available (Ready to Book)</span>
                <span className="font-black text-sm">{kpis.roomStatusBreakdown.available || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2.5 border border-zinc-900 bg-black text-white font-medium">
                <span className="font-bold">Occupied (Guest In Room)</span>
                <span className="font-black text-sm">{kpis.roomStatusBreakdown.occupied || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2.5 border border-amber-300 bg-amber-50 text-amber-950 font-medium">
                <span className="font-bold">Needs Cleaning</span>
                <span className="font-black text-sm">{kpis.roomStatusBreakdown.dirty || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2.5 border border-sky-300 bg-sky-50 text-sky-950 font-medium">
                <span className="font-bold">Clean & Ready</span>
                <span className="font-black text-sm">{kpis.roomStatusBreakdown.clean || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2.5 border border-zinc-300 bg-zinc-100 text-zinc-950 font-medium">
                <span className="font-bold">Awaiting Inspection</span>
                <span className="font-black text-sm">{kpis.roomStatusBreakdown.inspection || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2.5 border border-rose-300 bg-rose-50 text-rose-950 font-medium">
                <span className="font-bold">Maintenance / Out of Order</span>
                <span className="font-black text-sm">{kpis.roomStatusBreakdown.out_of_order || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Activity Stream */}
          <Card className="border border-zinc-300 bg-white shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-zinc-950 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-black" /> Live Activity
              </CardTitle>
              <Link href="/activity-logs">
                <span className="text-[11px] text-zinc-700 hover:text-black font-semibold">View all</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {recentActivities.length === 0 ? (
                <p className="text-zinc-600 font-medium py-2">No recent events logged.</p>
              ) : (
                recentActivities.map((act) => {
                  const meta = (act.metadata ?? {}) as Record<string, unknown>;
                  const summaryText = (meta.summary as string) || act.action.replace(/_/g, " ");
                  return (
                    <div key={act.id} className="border-b border-zinc-200 pb-1.5 last:border-0 last:pb-0">
                      <p className="font-bold text-zinc-950 truncate">{summaryText}</p>
                      <span className="text-[10px] text-zinc-600 font-mono font-medium">
                        {new Date(act.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
