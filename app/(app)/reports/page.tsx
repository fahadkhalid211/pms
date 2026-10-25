import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const organizations = await prisma.organization.findMany({ include: { properties: true } });
  const orgId = organizations[0]?.id;
  const properties = orgId ? await prisma.property.findMany({ where: { organizationId: orgId } }) : [];
  const propertyId = properties[0]?.id;

  const reservations = propertyId
    ? await prisma.reservation.findMany({ where: { propertyId, status: "confirmed" }, include: { rooms: { include: { room: true } } } })
    : [];
  const revenue = await prisma.payment.aggregate({ where: { organizationId: orgId ?? "", status: "captured" }, _sum: { amount: true } });
  const outstanding = await prisma.invoice.aggregate({ where: { organizationId: orgId ?? "", status: { in: ["issued", "overdue"] } }, _sum: { total: true } });

  const rooms = propertyId ? await prisma.room.findMany({ where: { propertyId }, select: { id: true, status: true } }) : [];
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const occupancy = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

  const nights = reservations.reduce((acc, r) => {
    const ms = new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime();
    return acc + Math.max(0, Math.round(ms / 86400000));
  }, 0);
  const adr = nights > 0 ? Number(revenue._sum.amount ?? 0) / nights : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Operational and financial summaries from live booking data.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Occupancy</div><div className="text-2xl font-bold">{occupancy}%</div><div className="text-xs text-muted-foreground">{occupied}/{rooms.length} rooms occupied</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Revenue captured</div><div className="text-2xl font-bold">{formatMoney(revenue._sum.amount ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">ADR</div><div className="text-2xl font-bold">{formatMoney(adr)}</div><div className="text-xs text-muted-foreground">per night</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Outstanding</div><div className="text-2xl font-bold">{formatMoney(outstanding._sum.total ?? 0)}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Booking mix</CardTitle><CardDescription>Reservations by source.</CardDescription></CardHeader>
        <CardContent>
          {["direct", "booking.com", "expedia", "airbnb", "walk_in"].map((source) => (
            <div key={source} className="flex items-center justify-between py-2 text-sm">
              <span className="capitalize">{source.replace(/_/g, " ")}</span>
              <span>{reservations.filter((r) => r.source === source).length}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
