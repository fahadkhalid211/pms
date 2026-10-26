import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { getExecutiveKpis } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("reports.view");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const kpis = await getExecutiveKpis({
      organizationId,
      propertyId,
      startDate,
      endDate,
    });

    return NextResponse.json({ success: true, data: kpis });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load reports" } }, { status: 500 });
  }
}
