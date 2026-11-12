import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getDecryptedCredentials } from "@/lib/integrations";
import { syncExternalIcalCalendar } from "@/lib/integrations/ota";

const icalSyncSchema = z.object({
  integrationId: z.string().optional(),
  propertyId: z.string().min(1, "Please select a target property."),
  provider: z.string().default("airbnb_ical"),
  name: z.string().optional(),
  icalUrl: z.string().url("Please enter a valid https:// calendar URL.").optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("integrations.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = icalSyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid calendar sync details" } },
        { status: 400 },
      );
    }

    let integrationId = parsed.data.integrationId;
    let resolvedIcalUrl = parsed.data.icalUrl;

    if (integrationId) {
      const creds = await getDecryptedCredentials(organizationId, integrationId);
      resolvedIcalUrl = resolvedIcalUrl || creds.icalImportUrl || creds.apiKey;
    }

    if (!resolvedIcalUrl) {
      return NextResponse.json(
        { success: false, error: { message: "Please provide the Airbnb / Booking.com calendar (.ics) import URL." } },
        { status: 400 },
      );
    }

    if (!integrationId) {
      const displayName =
        parsed.data.name ||
        (parsed.data.provider === "booking_com"
          ? "Booking.com Calendar Sync"
          : parsed.data.provider === "vrbo_ical"
          ? "VRBO Calendar Sync"
          : "Airbnb Calendar Sync");

      const existing = await prisma.integration.findFirst({
        where: {
          organizationId,
          propertyId: parsed.data.propertyId,
          provider: parsed.data.provider,
        },
      });

      if (existing) {
        integrationId = existing.id;
      } else {
        const created = await prisma.integration.create({
          data: {
            organizationId,
            propertyId: parsed.data.propertyId,
            provider: parsed.data.provider,
            name: displayName,
            status: "pending_config",
          },
        });
        integrationId = created.id;
      }
    }

    const result = await syncExternalIcalCalendar({
      organizationId,
      propertyId: parsed.data.propertyId,
      provider: parsed.data.provider,
      icalUrl: resolvedIcalUrl,
      userId: user.id,
      integrationId,
    });

    return NextResponse.json({
      success: true,
      data: {
        integrationId,
        ...result,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Calendar sync failed" } }, { status: 400 });
  }
}
