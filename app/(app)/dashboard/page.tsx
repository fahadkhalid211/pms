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
  Clock,
  ChevronRight,
  FileText,
  Activity,
} from "lucide-react";
import { getExecutiveKpis } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { getCurrentUser } = await import("@/lib/auth/session");
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? null;

  if (!user || !organizationId) return null;

  // Real scoped executive KPIs for last 30 days
  const kpis = await getExecutiveKpis({
    organizationId,
  });

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Good to see you, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here is your live hotel performance and operational overview across all properties.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              Detailed Reports
            </Button>
          </Link>
          <Link href="/reservations/new">
            <Button size="sm" className="gap-2 bg-primary">
              <Calendar className="h-4 w-4" />
              New Reservation
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (ADR, RevPAR, Occupancy, Outstanding) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Occupancy Rate</span>
              <BedDouble className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">{kpis.occupancyRate}%</span>
              <span className="text-xs text-muted-foreground">30-day avg</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.roomsSold} room nights sold ({kpis.totalRooms} total rooms)
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
              <span className="text-3xl font-bold tracking-tight text-foreground">{formatMoney(kpis.adr)}</span>
              <span className="text-xs text-muted-foreground">per sold room</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total room revenue: {formatMoney(kpis.roomRevenue)}
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
              <span className="text-3xl font-bold tracking-tight text-foreground">{formatMoney(kpis.revpar)}</span>
              <span className="text-xs text-muted-foreground">per available room</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis.roomsAvailableInPeriod} available room nights capacity
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding Balance</span>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-foreground">{formatMoney(kpis.outstandingBalance)}</span>
              <span className="text-xs text-muted-foreground">unsettled</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all open and overdue guest folios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Bar (Arrivals, Departures, Cancellations, No-shows) */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Today&apos;s Arrivals</div>
            <div className="text-xl font-bold">{todaysArrivals.length}</div>
          </div>
          <ArrowDownRight className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Today&apos;s Departures</div>
            <div className="text-xl font-bold">{todaysDepartures.length}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-sky-600" />
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">Cancellations (Period)</div>
            <div className="text-xl font-bold text-rose-600">{kpis.cancellationsCount}</div>
          </div>
          <AlertCircle className="h-4 w-4 text-rose-500" />
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">No-Shows (Period)</div>
            <div className="text-xl font-bold text-amber-600">{kpis.noShowsCount}</div>
          </div>
          <Clock className="h-4 w-4 text-amber-500" />
        </div>
      </div>

      {/* Main Grid: Arrivals / Departures Queues + Live Room Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Arrivals & Departures Queue */}
        <Card className="lg:col-span-2 border border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Today&apos;s Front Desk Movements</CardTitle>
              <CardDescription className="text-xs">
                Scheduled check-ins and check-outs for {todayStart.toLocaleDateString()}.
              </CardDescription>
            </div>
            <Link href="/frontdesk">
              <Button variant="outline" size="sm" className="text-xs gap-1">
                Open Front Desk <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {todaysArrivals.length === 0 && todaysDepartures.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No arrivals or departures scheduled for today.
              </div>
            ) : (
              <div className="space-y-3">
                {todaysArrivals.map((r) => {
                  const roomNumber = r.rooms[0]?.room?.number || "Unassigned";
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>
                            {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Direct Guest"}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                            Arrival
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
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
                      className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>
                            {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Direct Guest"}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-500/30">
                            Departure
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
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
          <Card className="border border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Live Room Inventory</CardTitle>
              <CardDescription className="text-xs">Real-time status of all {kpis.totalRooms} rooms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded p-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">Available</span>
                <span className="font-bold">{kpis.roomStatusBreakdown.available || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2 bg-primary/10 text-primary">
                <span className="font-medium">Occupied</span>
                <span className="font-bold">{kpis.roomStatusBreakdown.occupied || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <span className="font-medium">Turnover / Dirty</span>
                <span className="font-bold">{kpis.roomStatusBreakdown.dirty || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                <span className="font-medium">Clean / Ready</span>
                <span className="font-bold">{kpis.roomStatusBreakdown.clean || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2 bg-purple-500/10 text-purple-700 dark:text-purple-400">
                <span className="font-medium">Inspection Required</span>
                <span className="font-bold">{kpis.roomStatusBreakdown.inspection || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded p-2 bg-rose-500/10 text-rose-700 dark:text-rose-400">
                <span className="font-medium">Out of Order / Maintenance</span>
                <span className="font-bold">{kpis.roomStatusBreakdown.out_of_order || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Activity Stream */}
          <Card className="border border-border/80">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Live Activity
              </CardTitle>
              <Link href="/activity-logs">
                <span className="text-[11px] text-muted-foreground hover:text-foreground">View all</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground py-2">No recent events logged.</p>
              ) : (
                recentActivities.map((act) => {
                  const meta = (act.metadata ?? {}) as Record<string, unknown>;
                  const summaryText = (meta.summary as string) || act.action.replace(/_/g, " ");
                  return (
                    <div key={act.id} className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                      <p className="font-medium text-foreground truncate">{summaryText}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">
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
