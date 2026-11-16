import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { getPortfolioAnalytics } from "@/lib/analytics";

export async function GET() {
  try {
    const user = await requirePermission("reports.view");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const analytics = await getPortfolioAnalytics(organizationId);
    return NextResponse.json({ success: true, data: analytics });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load analytics" } }, { status: 500 });
  }
}
