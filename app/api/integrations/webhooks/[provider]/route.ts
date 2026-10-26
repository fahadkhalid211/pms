import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { handleWebhookEvent } from "@/lib/integrations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || searchParams.get("organizationId");

    const rawBody = await request.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { raw: rawBody };
    }

    // Determine organizationId
    let resolvedOrgId = orgId;
    if (!resolvedOrgId) {
      // Try to find active integration matching provider
      const integration = await prisma.integration.findFirst({
        where: { provider },
        select: { organizationId: true, id: true },
      });
      resolvedOrgId = integration?.organizationId ?? null;
    }

    if (!resolvedOrgId) {
      return NextResponse.json(
        { success: false, error: { message: "Unknown tenant organization for webhook." } },
        { status: 400 },
      );
    }

    // Extract external event ID for deduplication
    const externalId =
      request.headers.get("x-webhook-id") ||
      request.headers.get("x-event-id") ||
      payload.id ||
      payload.externalId ||
      payload.eventId ||
      null;

    const eventType = payload.type || payload.event || payload.eventType || "generic.event";

    const result = await handleWebhookEvent({
      organizationId: resolvedOrgId,
      provider,
      eventType,
      externalId,
      payload,
    });

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
      status: result.status,
      duplicate: result.duplicate,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Webhook processing error" } },
      { status: 500 },
    );
  }
}
