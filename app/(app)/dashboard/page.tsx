import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { getCurrentUser } = await import("@/lib/auth/session");
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? null;

  const rooms = organizationId
    ? await prisma.room.findMany({
        where: { property: { organizationId, status: "active" } },
        select: { id: true, status: true },
      })
    : [];

  const roomStatusCounts = rooms.reduce<Record<string, number>>((acc, room) => {
    acc[room.status] = (acc[room.status] ?? 0) + 1;
    return acc;
  }, {});

  const today = new Date();
  const todaysReservations = organizationId
    ? await prisma.reservation.findMany({
        where: {
          organizationId,
          property: { organizationId, status: "active" },
          checkIn: { lte: new Date(today.getTime() + 86400000) },
          checkOut: { gt: today },
        },
        orderBy: { checkIn: "asc" },
        take: 20,
        include: { guest: { select: { firstName: true, lastName: true } } },
      })
    : [];

  const arrivals = todaysReservations.filter((r) => r.checkIn.toDateString() === today.toDateString());
  const departures = todaysReservations.filter((r) => r.checkOut.toDateString() === today.toDateString());

  const outstanding = organizationId
    ? await prisma.invoice.aggregate({
        where: { organizationId, status: { in: ["issued", "overdue"] } },
        _sum: { total: true },
      })
    : null;

  const inHouse = roomStatusCounts["occupied"] ?? 0;
  const occupancyRate = rooms.length > 0 ? Math.round((inHouse / rooms.length) * 100) : 0;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Good to see you, {user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Here is what is happening across your properties today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current occupancy" value={`${occupancyRate}%`} hint={`${inHouse} of ${rooms.length} rooms occupied`} />
        <StatCard label="Today's arrivals" value={String(arrivals.length)} hint="Expected check-ins" />
        <StatCard label="Today's departures" value={String(departures.length)} hint="Expected check-outs" />
        <StatCard label="Outstanding balances" value={outstanding ? formatMoney(outstanding._sum.total ?? 0) : "—"} hint="Open invoices" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Today&apos;s schedule</CardTitle>
              <CardDescription>Arrivals and departures for the selected period.</CardDescription>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm">
                <Link href="/frontdesk" className="inline-flex items-center justify-center">Open front desk</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todaysReservations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No reservations today. Enjoy the calm.</p>
            ) : (
              <div className="space-y-3">
                {todaysReservations.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">
                        {r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Walk-in / Unassigned"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.checkIn.toDateString()} → {r.checkOut.toDateString()} · {r.adults + r.children} guests
                      </div>
                    </div>
                    <span className="text-sm font-medium">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Room status</CardTitle>
            <CardDescription>Live distribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(roomStatusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{status.replace(/_/g, " ")}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
