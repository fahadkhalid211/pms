import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { resolveOAuthAuthorizePlan } from "@/lib/integrations/ota";

const ALLOWED_PROVIDERS = ["hospitable", "airbnb", "airbnb_ical", "booking_com"] as const;

export async function GET(request: Request) {
  try {
    const user = await requirePermission("integrations.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { searchParams, origin } = new URL(request.url);
    const provider = searchParams.get("provider");
    const propertyId = searchParams.get("propertyId") || undefined;

    if (!provider || !ALLOWED_PROVIDERS.includes(provider as (typeof ALLOWED_PROVIDERS)[number])) {
      return NextResponse.json({ success: false, error: { message: "Unsupported OAuth provider." } }, { status: 400 });
    }

    const appOrigin = process.env.AUTH_URL?.replace(/\/$/, "") || origin;
    const plan = await resolveOAuthAuthorizePlan({
      origin: appOrigin,
      organizationId,
      userId: user.id,
      provider: provider as (typeof ALLOWED_PROVIDERS)[number],
      propertyId,
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to initiate sign-in" } }, { status: 400 });
  }
}
