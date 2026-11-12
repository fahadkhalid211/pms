import crypto from "crypto";
import prisma from "@/lib/db";
import { Prisma, IntegrationStatus, WebhookEventStatus } from "@prisma/client";
import { encryptSecret, decryptSecret } from "@/lib/ai/encryption";
import { logActivity } from "@/lib/audit";
import { processHospitableWebhook } from "@/lib/integrations/hospitable";

export interface IntegrationDefinition {
  provider: string;
  name: string;
  category: "payments" | "ota" | "messaging" | "accounting" | "automation";
  description: string;
  supportsWebhooks: boolean;
  supportsIcal: boolean;
  isStubbed: boolean;
}

export const SUPPORTED_INTEGRATIONS: IntegrationDefinition[] = [
  {
    provider: "hospitable",
    name: "Hospitable Two-Way Sync",
    category: "ota",
    description: "Import properties, owner/user details, guests & bookings from Hospitable and push local calendar availability back in real time.",
    supportsWebhooks: true,
    supportsIcal: false,
    isStubbed: false,
  },
  {
    provider: "stripe",
    name: "Stripe Payments & Terminal",
    category: "payments",
    description: "Credit card processing, pre-authorizations, and connected hardware terminals.",
    supportsWebhooks: true,
    supportsIcal: false,
    isStubbed: false,
  },
  {
    provider: "airbnb_ical",
    name: "Airbnb Host Account & Calendar Sync",
    category: "ota",
    description: "Sign in to Airbnb to sync reservations & availability or link via Hospitable.",
    supportsWebhooks: true,
    supportsIcal: true,
    isStubbed: false,
  },
  {
    provider: "vrbo_ical",
    name: "VRBO / HomeAway iCal Sync",
    category: "ota",
    description: "Export and import calendar feeds for VRBO vacation rentals.",
    supportsWebhooks: false,
    supportsIcal: true,
    isStubbed: false,
  },
  {
    provider: "booking_com",
    name: "Booking.com Channel Connector",
    category: "ota",
    description: "Sign in to Booking.com Extranet to connect channel manager sync or import/export availability.",
    supportsWebhooks: true,
    supportsIcal: true,
    isStubbed: false,
  },
  {
    provider: "whatsapp",
    name: "WhatsApp Business API",
    category: "messaging",
    description: "Automated booking confirmations and pre-arrival messages via Meta WhatsApp Cloud API.",
    supportsWebhooks: true,
    supportsIcal: false,
    isStubbed: true,
  },
  {
    provider: "slack",
    name: "Slack Front-Desk Alerts",
    category: "messaging",
    description: "Real-time dispatch notifications for guest check-ins, VIP arrivals, and maintenance issues.",
    supportsWebhooks: false,
    supportsIcal: false,
    isStubbed: true,
  },
  {
    provider: "quickbooks",
    name: "QuickBooks Online Accounting",
    category: "accounting",
    description: "Sync invoices, payouts, and tax receipts automatically into QuickBooks ledgers.",
    supportsWebhooks: true,
    supportsIcal: false,
    isStubbed: true,
  },
  {
    provider: "zapier",
    name: "Zapier Automation Hooks",
    category: "automation",
    description: "Trigger multi-app Zaps on reservation, guest, and billing lifecycle events.",
    supportsWebhooks: true,
    supportsIcal: false,
    isStubbed: true,
  },
];

/**
 * Encrypts and securely saves credentials for an integration.
 */
export async function saveIntegrationCredentials(input: {
  organizationId: string;
  integrationId: string;
  credentials: Record<string, string>;
}) {
  const encrypted: Record<string, string> = {};
  for (const [key, val] of Object.entries(input.credentials)) {
    if (val && val.trim()) {
      encrypted[key] = encryptSecret(val.trim());
    }
  }

  const updated = await prisma.integration.update({
    where: {
      id: input.integrationId,
      organizationId: input.organizationId,
    },
    data: {
      credentials: encrypted,
      status: "connected",
      lastError: null,
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    source: "backend",
    category: "operations",
    action: "integration.credentials_updated",
    summary: `Updated encrypted credentials for integration '${updated.name}' (${updated.provider}).`,
    entityType: "Integration",
    entityId: updated.id,
  });

  return updated;
}

/**
 * Retrieves and decrypts integration credentials.
 */
export async function getDecryptedCredentials(organizationId: string, integrationId: string): Promise<Record<string, string>> {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId },
    select: { credentials: true },
  });

  if (!integration || !integration.credentials || typeof integration.credentials !== "object") {
    return {};
  }

  const raw = integration.credentials as Record<string, string>;
  const decrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v) {
      try {
        decrypted[k] = decryptSecret(v);
      } catch {
        decrypted[k] = "[DECRYPTION_FAILED]";
      }
    }
  }
  return decrypted;
}

/**
 * Verifies webhook cryptographic signature (HMAC SHA256).
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const cleanSig = signature.replace(/^sha256=/i, "").trim();
    const expected = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    return crypto.timingSafeEqual(Buffer.from(cleanSig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Ingests external webhook event with deduplication by externalId.
 * Duplicate deliveries are idempotently recorded as 'ignored' without re-execution.
 */
export async function handleWebhookEvent(input: {
  organizationId: string;
  provider: string;
  integrationId?: string | null;
  eventType: string;
  externalId?: string | null;
  payload: any;
  signatureVerified?: boolean;
}): Promise<{ status: WebhookEventStatus; eventId: string; duplicate: boolean }> {
  // Deduplication gate: check if externalId was already processed
  if (input.externalId && input.externalId.trim()) {
    const existing = await prisma.webhookEvent.findFirst({
      where: {
        organizationId: input.organizationId,
        externalId: input.externalId.trim(),
      },
    });

    if (existing) {
      // Record duplicate delivery attempt with status 'ignored'
      // Set externalId to null on the duplicate log so unique constraint is not violated
      const ignoredRecord = await prisma.webhookEvent.create({
        data: {
          organizationId: input.organizationId,
          integrationId: input.integrationId,
          eventType: input.eventType,
          externalId: null,
          payload: input.payload as Prisma.InputJsonValue,
          status: "ignored",
          error: `Duplicate externalId: ${input.externalId.trim()} already processed in event ${existing.id}`,
          processedAt: new Date(),
        },
      });

      return { status: "ignored", eventId: ignoredRecord.id, duplicate: true };
    }
  }

  // Create new webhook event record
  let webhookRecord;
  try {
    webhookRecord = await prisma.webhookEvent.create({
      data: {
        organizationId: input.organizationId,
        integrationId: input.integrationId,
        eventType: input.eventType,
        externalId: input.externalId,
        payload: input.payload as Prisma.InputJsonValue,
        status: "processing",
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const ignoredRecord = await prisma.webhookEvent.create({
        data: {
          organizationId: input.organizationId,
          integrationId: input.integrationId,
          eventType: input.eventType,
          externalId: null,
          payload: input.payload as Prisma.InputJsonValue,
          status: "ignored",
          error: `Duplicate externalId: ${input.externalId?.trim()} (race condition P2002)`,
          processedAt: new Date(),
        },
      });
      return { status: "ignored", eventId: ignoredRecord.id, duplicate: true };
    }
    throw err;
  }

  try {
    // Dispatch provider processing
    if (input.provider === "hospitable") {
      await processHospitableWebhook({
        organizationId: input.organizationId,
        integrationId: input.integrationId,
        eventType: input.eventType,
        payload: (input.payload || {}) as Record<string, unknown>,
      });
    } else if (input.provider === "stripe") {
      // Stub: handle stripe event
      if (input.eventType === "payment_intent.succeeded" && input.payload?.paymentId) {
        await prisma.payment.updateMany({
          where: {
            organizationId: input.organizationId,
            id: input.payload.paymentId,
          },
          data: { status: "captured" },
        });
      }
    }

    const processed = await prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: "processed",
        processedAt: new Date(),
      },
    });

    await logActivity({
      organizationId: input.organizationId,
      source: "backend",
      category: "operations",
      action: "webhook.processed",
      summary: `Processed webhook event ${input.eventType} (provider: ${input.provider}, externalId: ${input.externalId ?? "none"}).`,
      entityType: "WebhookEvent",
      entityId: processed.id,
    });

    return { status: "processed", eventId: processed.id, duplicate: false };
  } catch (err: unknown) {
    const errorMsg = (err as Error).message ?? "Processing failed";
    await prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: "failed",
        error: errorMsg,
        processedAt: new Date(),
      },
    });

    return { status: "failed", eventId: webhookRecord.id, duplicate: false };
  }
}

/**
 * Generates RFC 5545 iCalendar feed (.ics) for active reservations of a property.
 */
export async function generatePropertyIcalFeed(organizationId: string, propertyId: string): Promise<string> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true, name: true, timezone: true },
  });

  if (!property) {
    throw new Error("Property not found or unauthorized.");
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId,
      propertyId,
      status: { in: ["confirmed", "checked_in"] },
    },
    include: {
      rooms: { include: { room: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  function formatIcsDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  const events = reservations.map((res) => {
    const startStr = formatIcsDate(res.checkIn);
    const endStr = formatIcsDate(res.checkOut);
    const roomStr = res.rooms.map((r) => r.room.number).join(", ") || "General";

    return [
      "BEGIN:VEVENT",
      `UID:lumina-${res.id}@pms.internal`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${startStr}`,
      `DTEND;VALUE=DATE:${endStr}`,
      `SUMMARY:Reserved - Room ${roomStr} (Lumina PMS ${res.code})`,
      `DESCRIPTION:Reservation ${res.code} at ${property.name}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].join("\r\n");
  });

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lumina PMS//iCal Channel Sync//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${property.name} Bookings`,
    `X-WR-TIMEZONE:${property.timezone || "UTC"}`,
    ...events,
    "END:VCALENDAR",
  ];

  return icsLines.join("\r\n");
}

/**
 * Parses external iCal .ics feed content and syncs reservations.
 */
export function parseIcalEvents(icsContent: string): Array<{ uid: string; summary: string; startDate: string; endDate: string }> {
  const events: Array<{ uid: string; summary: string; startDate: string; endDate: string }> = [];
  const lines = icsContent.split(/\r?\n/);

  let inEvent = false;
  let current: Partial<{ uid: string; summary: string; startDate: string; endDate: string }> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (trimmed === "END:VEVENT") {
      if (current.uid && current.startDate && current.endDate) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? "External Booking",
          startDate: current.startDate,
          endDate: current.endDate,
        });
      }
      inEvent = false;
    } else if (inEvent) {
      if (trimmed.startsWith("UID:")) {
        current.uid = trimmed.substring(4);
      } else if (trimmed.startsWith("SUMMARY:")) {
        current.summary = trimmed.substring(8);
      } else if (trimmed.startsWith("DTSTART")) {
        const parts = trimmed.split(":");
        if (parts[1]) current.startDate = parts[1].slice(0, 8); // YYYYMMDD
      } else if (trimmed.startsWith("DTEND")) {
        const parts = trimmed.split(":");
        if (parts[1]) current.endDate = parts[1].slice(0, 8); // YYYYMMDD
      }
    }
  }

  return events;
}
