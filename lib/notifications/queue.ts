import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { NotificationStatus, NotificationChannel } from "@prisma/client";
import {
  EnqueueNotificationInput,
  NotificationJobPayload,
  DeliveryLogEntry,
  PropertyBrand,
} from "./types";
import { renderTemplate } from "./templates";
import { getEmailProvider } from "./providers";
import { getRecipientPreferences, shouldDeliverNotification } from "./preferences";
import { NotFoundError, CrossTenantViolationError } from "@/lib/errors";

export interface TenantContext {
  organizationId: string;
  propertyId?: string | null;
}

// ---------------------------------------------------------------------------
// 1. Enqueue Notification with Preferences & Property Branding
// ---------------------------------------------------------------------------
export async function enqueueNotification(
  ctx: TenantContext,
  input: EnqueueNotificationInput,
) {
  if (input.organizationId !== ctx.organizationId) {
    throw new CrossTenantViolationError("Cannot enqueue notification for another organization.");
  }

  const channel: NotificationChannel = input.channel ?? "email";
  const notificationType = input.type;

  // 1. Privacy & Preferences Gate Check
  if (input.guestId || input.userId) {
    const preferences = await getRecipientPreferences({
      guestId: input.guestId,
      userId: input.userId,
      organizationId: ctx.organizationId,
    });

    const check = shouldDeliverNotification(preferences, channel, notificationType);
    if (!check.allowed) {
      return {
        id: `suppressed_${crypto.randomUUID().slice(0, 8)}`,
        status: "suppressed" as const,
        reason: check.reason,
        suppressed: true,
      };
    }
  }

  // 2. Resolve Property Branding
  let brand: PropertyBrand = {
    name: "Lumina Hospitality",
    brandColor: "#0ea5e9",
  };

  const propId = input.propertyId ?? ctx.propertyId;
  if (propId) {
    const property = await prisma.property.findFirst({
      where: { id: propId, organizationId: ctx.organizationId },
    });
    if (property) {
      brand = {
        name: property.name,
        address: [property.addressLine1, property.city, property.state, property.postalCode].filter(Boolean).join(", "),
        phone: property.phone ?? undefined,
        email: property.email ?? undefined,
        brandColor: "#0ea5e9",
      };
    }
  }

  // 3. Render Branded Template
  const templateCode = input.templateCode || input.type;
  const compiled = renderTemplate(
    templateCode,
    {
      ...(input.variables ?? {}),
      subject: input.subject,
    },
    brand,
  );

  const runAt = input.scheduledFor ? input.scheduledFor.toISOString() : new Date().toISOString();
  const maxAttempts = input.maxAttempts ?? 3;

  const payload: NotificationJobPayload = {
    ...(input.payload ?? {}),
    templateCode,
    subject: input.subject || compiled.subject,
    bodyHtml: compiled.html,
    bodyText: compiled.text,
    variables: input.variables,
    attempts: 0,
    maxAttempts,
    runAt,
    brand,
    deliveryLogs: [],
  };

  // 4. Insert Notification into transactional queue
  const notification = await prisma.notification.create({
    data: {
      organizationId: ctx.organizationId,
      propertyId: propId ?? undefined,
      userId: input.userId ?? undefined,
      channel,
      type: notificationType,
      status: "queued",
      toEmail: input.toEmail ?? undefined,
      toPhone: input.toPhone ?? undefined,
      relatedType: input.relatedType ?? undefined,
      relatedId: input.relatedId ?? undefined,
      payload: JSON.parse(JSON.stringify(payload)),
    },
  });

  return {
    ...notification,
    suppressed: false,
  };
}

// ---------------------------------------------------------------------------
// 2. Process Queue with Retries, Exponential Backoff, and Delivery Logs
// ---------------------------------------------------------------------------
export async function processNotificationQueue(
  ctx?: TenantContext,
  limit = 10,
) {
  const now = new Date();

  // Find candidate jobs in pending or queued status
  const candidates = await prisma.notification.findMany({
    where: {
      ...(ctx?.organizationId ? { organizationId: ctx.organizationId } : {}),
      status: { in: ["pending", "queued"] },
    },
    take: limit * 2, // Take buffer for runAt filter
    orderBy: { createdAt: "asc" },
  });

  const dueJobs = candidates.filter((job) => {
    const payload = (job.payload as NotificationJobPayload) ?? {};
    if (!payload.runAt) return true;
    return new Date(payload.runAt) <= now;
  }).slice(0, limit);

  let succeeded = 0;
  let failed = 0;
  const results: any[] = [];

  const emailProvider = getEmailProvider();

  for (const job of dueJobs) {
    const payload: NotificationJobPayload = (job.payload as NotificationJobPayload) ?? {};
    const currentAttempts = (payload.attempts ?? 0) + 1;
    const maxAttempts = payload.maxAttempts ?? 3;
    const logs: DeliveryLogEntry[] = payload.deliveryLogs ?? [];

    let statusUpdate: NotificationStatus = "queued";
    let errorMsg: string | null = null;
    let sentAtDate: Date | null = null;

    if (job.channel === "email" && job.toEmail) {
      const subject = payload.subject || `${payload.brand?.name || "Lumina"} Notification`;
      const html = payload.bodyHtml || `<p>${payload.bodyText || ""}</p>`;
      const text = payload.bodyText || "";

      const res = await emailProvider.sendEmail({
        to: job.toEmail,
        subject,
        html,
        text,
        from: payload.brand?.email,
      });

      const logEntry: DeliveryLogEntry = {
        id: crypto.randomUUID(),
        provider: res.provider,
        providerRef: res.providerRef,
        status: res.status,
        durationMs: res.durationMs,
        error: res.error,
        timestamp: new Date().toISOString(),
      };
      logs.push(logEntry);

      if (res.status === "sent") {
        statusUpdate = "sent";
        sentAtDate = res.sentAt;
        succeeded++;
      } else {
        errorMsg = res.error || "Provider delivery failed";
        if (currentAttempts >= maxAttempts) {
          statusUpdate = "failed";
          failed++;
        } else {
          statusUpdate = "queued";
          // Exponential backoff: 2^attempts * 1000ms
          const nextRun = new Date(Date.now() + Math.pow(2, currentAttempts) * 1000);
          payload.runAt = nextRun.toISOString();
          failed++;
        }
      }
    } else {
      // In-app or other channel simulation
      statusUpdate = "sent";
      sentAtDate = new Date();
      succeeded++;
    }

    payload.attempts = currentAttempts;
    payload.lastAttemptAt = new Date().toISOString();
    payload.deliveryLogs = logs;

    const updated = await prisma.notification.update({
      where: { id: job.id },
      data: {
        status: statusUpdate,
        sentAt: sentAtDate,
        error: errorMsg,
        payload: JSON.parse(JSON.stringify(payload)),
      },
    });

    results.push(updated);
  }

  return {
    processed: dueJobs.length,
    succeeded,
    failed,
    notifications: results,
  };
}

// ---------------------------------------------------------------------------
// 3. Retry Failed Notification
// ---------------------------------------------------------------------------
export async function retryNotification(
  ctx: TenantContext,
  notificationId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, organizationId: ctx.organizationId },
  });

  if (!notification) {
    throw new NotFoundError("Notification not found.");
  }

  const payload: NotificationJobPayload = (notification.payload as NotificationJobPayload) ?? {};
  payload.attempts = 0;
  payload.runAt = new Date().toISOString();

  return prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "queued",
      error: null,
      payload: JSON.parse(JSON.stringify(payload)),
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Query Delivery Logs Across Notifications
// ---------------------------------------------------------------------------
export async function getDeliveryLogs(
  ctx: TenantContext,
  filters?: { notificationId?: string; status?: "sent" | "failed" },
) {
  const notifications = await prisma.notification.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(filters?.notificationId ? { id: filters.notificationId } : {}),
    },
    select: {
      id: true,
      type: true,
      channel: true,
      toEmail: true,
      status: true,
      createdAt: true,
      payload: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const flatLogs: Array<DeliveryLogEntry & { notificationId: string; channel: string; toEmail?: string | null; type: string }> = [];

  for (const n of notifications) {
    const payload = (n.payload as NotificationJobPayload) ?? {};
    const logs = payload.deliveryLogs ?? [];
    for (const log of logs) {
      if (filters?.status && log.status !== filters.status) continue;
      flatLogs.push({
        ...log,
        notificationId: n.id,
        channel: n.channel,
        toEmail: n.toEmail,
        type: n.type,
      });
    }
  }

  return flatLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
