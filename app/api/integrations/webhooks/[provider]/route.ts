import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDecryptedCredentials, handleWebhookEvent, verifyWebhookSignature } from "@/lib/integrations";

/**
 * Health check & verification probe handler (GET)
 * Hospitable, external monitors, or browsers query GET to check if the webhook endpoint is reachable.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId") || searchParams.get("organizationId");

  return NextResponse.json(
    {
      status: "ok",
      provider,
      organizationId: orgId || null,
      active: true,
      timestamp: new Date().toISOString(),
      message: `Lumina PMS ${provider} webhook endpoint is active and ready to receive events.`,
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      },
    },
  );
}

/**
 * Endpoint probe handler (HEAD)
 * Some webhook providers send HEAD requests to verify reachability and HTTP 200 response headers.
 */
export async function HEAD(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  return new NextResponse(null, {
    status: 200,
    headers: {
      "X-Webhook-Provider": provider,
      "X-Webhook-Status": "active",
      "Allow": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * CORS Preflight (OPTIONS)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Allow": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Ingest incoming webhook payloads (POST)
 */
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
    if (rawBody.trim()) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { raw: rawBody };
      }
    }

    const eventType = String(
      payload.action || payload.type || payload.event || payload.eventType || "generic.event",
    ).toLowerCase();

    // Check if this is a test/ping/handshake from Hospitable or an endpoint validator
    const isPingOrTest =
      !rawBody.trim() ||
      rawBody.trim() === "{}" ||
      eventType === "ping" ||
      eventType === "test" ||
      eventType === "verify" ||
      Boolean(payload.test || payload.ping || payload.verification) ||
      (eventType === "generic.event" && !payload.data && !payload.id && !payload.reservation && !payload.property);

    const integration = orgId
      ? await prisma.integration.findFirst({
          where: { organizationId: orgId, provider },
          select: { id: true, organizationId: true },
        })
      : await prisma.integration.findFirst({
          where: { provider },
          select: { id: true, organizationId: true },
        });

    let resolvedOrgId = orgId || integration?.organizationId || null;
    if (!resolvedOrgId) {
      const primaryOrg = await prisma.organization.findFirst({ select: { id: true } });
      resolvedOrgId = primaryOrg?.id || null;
    }

    // If it's a test/ping/handshake, immediately respond with 200 OK so Hospitable's connectivity check succeeds
    if (isPingOrTest) {
      return NextResponse.json(
        {
          success: true,
          received: true,
          status: "ok",
          test: true,
          provider,
          organizationId: resolvedOrgId,
          message: `Lumina PMS ${provider} webhook verification ping received and acknowledged successfully.`,
          challenge: typeof payload.challenge === "string" ? payload.challenge : undefined,
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

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
          request.headers.get("x-hub-signature-256") ||
          "";

        if (!incomingSig) {
          return NextResponse.json(
            { success: false, error: { message: "Webhook signature header missing." } },
            { status: 401 },
          );
        }

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

    const result = await handleWebhookEvent({
      organizationId: resolvedOrgId,
      provider,
      integrationId: integration?.id ?? null,
      eventType: String(payload.action || payload.type || payload.event || payload.eventType || "generic.event"),
      externalId,
      payload,
      signatureVerified,
    });

    return NextResponse.json(
      {
        received: true,
        eventId: result.eventId,
        status: result.status,
        duplicate: result.duplicate,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Webhook processing error" } },
      { status: 500 },
    );
  }
}
