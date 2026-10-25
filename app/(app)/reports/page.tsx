import { getAuthContext } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/login");
  }

  const summary = await dal.reports.getOperationalSummary(ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Operational and financial metrics scoped strictly to your organization.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Occupancy</div>
            <div className="text-2xl font-bold">{summary.occupancyPercentage}%</div>
            <div className="text-xs text-muted-foreground">
              {summary.occupiedRooms}/{summary.roomsCount} rooms occupied
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Revenue captured</div>
            <div className="text-2xl font-bold">{formatMoney(summary.revenueCaptured)}</div>
            <div className="text-xs text-muted-foreground">Settled payments</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">ADR (Avg Daily Rate)</div>
            <div className="text-2xl font-bold">{formatMoney(summary.adr)}</div>
            <div className="text-xs text-muted-foreground">per room night sold</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Outstanding folio balance</div>
            <div className="text-2xl font-bold">{formatMoney(summary.outstandingTotal)}</div>
            <div className="text-xs text-muted-foreground">Issued & overdue invoices</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Distribution</CardTitle>
          <CardDescription>Reservations by channel source for your properties.</CardDescription>
        </CardHeader>
        <CardContent>
          {["direct", "public_portal", "agent", "phone", "walk_in", "ota"].map((source) => {
            const count = summary.reservations.filter((r) => r.source === source).length;
            return (
              <div key={source} className="flex items-center justify-between py-2 text-sm border-b last:border-b-0">
                <span className="capitalize">{source.replace(/_/g, " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
