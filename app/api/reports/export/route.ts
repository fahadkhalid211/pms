import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { exportCsvReport } from "@/lib/reports";
import { logActivity } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("reports.view");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type") || "financial";
    const propertyId = searchParams.get("propertyId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    if (!["financial", "occupancy", "reservations"].includes(typeParam)) {
      return NextResponse.json({ success: false, error: { message: "Invalid report type" } }, { status: 400 });
    }

    const csvContent = await exportCsvReport({
      organizationId,
      type: typeParam as "financial" | "occupancy" | "reservations",
      propertyId,
      startDate,
      endDate,
    });

    const filename = `lumina-report-${typeParam}-${new Date().toISOString().split("T")[0]}.csv`;

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "operations",
      action: "reports.exported_csv",
      summary: `Exported ${typeParam} CSV report.`,
    });

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to export report" } }, { status: 500 });
  }
}
