import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDecryptedCredentials, handleWebhookEvent, verifyWebhookSignature } from "@/lib/integrations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || searchParams.get("organizationId");

    const rawBody = await request.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { raw: rawBody };
    }

    const integration = orgId
      ? await prisma.integration.findFirst({
          where: { organizationId: orgId, provider },
          select: { id: true, organizationId: true },
        })
      : await prisma.integration.findFirst({
          where: { provider },
          select: { id: true, organizationId: true },
        });

    const resolvedOrgId = orgId || integration?.organizationId || null;

    if (!resolvedOrgId) {
      return NextResponse.json(
        { success: false, error: { message: "Unknown tenant organization for webhook." } },
        { status: 400 },
      );
    }

    let signatureVerified = false;
    if (integration) {
      const creds = await getDecryptedCredentials(resolvedOrgId, integration.id);
      const signingSecret = creds.webhookSecret || creds.apiSecret;
      if (signingSecret) {
        const incomingSig =
          request.headers.get("x-hospitable-signature") ||
          request.headers.get("x-webhook-signature") ||
          request.headers.get("signature") ||
          "";
        if (!verifyWebhookSignature(rawBody, incomingSig, signingSecret)) {
          return NextResponse.json(
            { success: false, error: { message: "Invalid webhook signature." } },
            { status: 401 },
          );
        }
        signatureVerified = true;
      }
    }

    const dataObj = (payload.data && typeof payload.data === "object" ? payload.data : null) as Record<string, unknown> | null;
    const externalId =
      request.headers.get("x-webhook-id") ||
      request.headers.get("x-event-id") ||
      (typeof payload.id === "string" ? payload.id : null) ||
      (typeof payload.externalId === "string" ? payload.externalId : null) ||
      (typeof payload.eventId === "string" ? payload.eventId : null) ||
      (typeof dataObj?.id === "string" ? `${String(payload.action || payload.event || "ev")}:${dataObj.id}` : null);

    const eventType = String(
      payload.action || payload.type || payload.event || payload.eventType || "generic.event",
    );

    const result = await handleWebhookEvent({
      organizationId: resolvedOrgId,
      provider,
      integrationId: integration?.id ?? null,
      eventType,
      externalId,
      payload,
      signatureVerified,
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
