import prisma from "@/lib/db";
import { logActivity } from "@/lib/audit";

/**
 * Purges historical activity logs, webhook events, and closed chatbot sessions older than specified retention days.
 */
export async function purgeRetentionLogs(input: {
  organizationId: string;
  daysToKeep?: number;
  dryRun?: boolean;
}) {
  const days = Math.max(7, input.daysToKeep ?? 90);
  const cutoffDate = new Date(Date.now() - days * 86400000);

  if (input.dryRun) {
    const activityCount = await prisma.auditLog.count({
      where: { organizationId: input.organizationId, createdAt: { lt: cutoffDate } },
    });
    const webhookCount = await prisma.webhookEvent.count({
      where: { organizationId: input.organizationId, createdAt: { lt: cutoffDate } },
    });
    return {
      dryRun: true,
      cutoffDate: cutoffDate.toISOString(),
      eligibleActivityLogs: activityCount,
      eligibleWebhookEvents: webhookCount,
    };
  }

  // 1. Purge old activity logs
  const deletedLogs = await prisma.auditLog.deleteMany({
    where: {
      organizationId: input.organizationId,
      createdAt: { lt: cutoffDate },
    },
  });

  // 2. Purge old webhook events
  const deletedWebhooks = await prisma.webhookEvent.deleteMany({
    where: {
      organizationId: input.organizationId,
      createdAt: { lt: cutoffDate },
    },
  });

  // 3. Purge old closed chatbot sessions
  const deletedChats = await prisma.chatbotConversation.deleteMany({
    where: {
      organizationId: input.organizationId,
      status: "closed",
      updatedAt: { lt: cutoffDate },
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    source: "backend",
    category: "operations",
    action: "retention.purge_executed",
    summary: `Executed retention purge (kept ${days} days): deleted ${deletedLogs.count} activity logs, ${deletedWebhooks.count} webhooks, ${deletedChats.count} closed chats.`,
  });

  return {
    dryRun: false,
    cutoffDate: cutoffDate.toISOString(),
    purgedActivityLogs: deletedLogs.count,
    purgedWebhookEvents: deletedWebhooks.count,
    purgedChatbotSessions: deletedChats.count,
  };
}

/**
 * GDPR Data Portability (Article 15):
 * Exports complete JSON data archive for a guest.
 */
export async function exportCustomerArchive(organizationId: string, guestId: string) {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, organizationId },
    include: {
      profile: true,
      reservations: {
        include: {
          rooms: { include: { room: true } },
          invoices: { include: { payments: true } },
        },
      },
      requests: true,
    },
  });

  if (!guest) {
    throw new Error("Guest record not found or unauthorized.");
  }

  return {
    exportDate: new Date().toISOString(),
    organizationId,
    guest: {
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: guest.phone,
      notes: guest.notes,
      createdAt: guest.createdAt,
    },
    profile: guest.profile,
    reservations: guest.reservations.map((r) => ({
      code: r.code,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      adults: r.adults,
      children: r.children,
      currency: r.currency,
      totalAmount: r.totalAmount.toString(),
      rooms: r.rooms.map((rm) => rm.room.number),
      invoices: r.invoices.map((inv) => ({
        invoiceNumber: inv.number,
        total: inv.total.toString(),
        status: inv.status,
        payments: inv.payments.map((p) => ({
          amount: p.amount.toString(),
          method: p.method,
          status: p.status,
          createdAt: p.createdAt,
        })),
      })),
    })),
    requests: guest.requests,
  };
}

/**
 * GDPR Right to Erasure / Anonymization (Article 17):
 * Anonymizes customer PII while strictly maintaining financial record consistency.
 */
export async function anonymizeCustomerRecord(organizationId: string, guestId: string) {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, organizationId },
  });

  if (!guest) {
    throw new Error("Guest record not found or unauthorized.");
  }

  // Anonymize guest contact details and notes
  await prisma.guest.update({
    where: { id: guestId },
    data: {
      firstName: "Anonymized",
      lastName: `Guest-${guestId.slice(-4).toUpperCase()}`,
      email: null,
      phone: null,
      notes: "[PII anonymized per GDPR Right to Erasure]",
    },
  });

  // Clear preferences in profile
  await prisma.guestProfile.updateMany({
    where: { guestId, organizationId },
    data: {
      preferences: {},
      idDocumentNumber: null,
      idDocumentType: null,
      idVerified: false,
    },
  });

  await logActivity({
    organizationId,
    source: "backend",
    category: "operations",
    action: "privacy.guest_anonymized",
    summary: `Anonymized customer PII for guest ID #${guestId}.`,
    entityType: "Guest",
    entityId: guestId,
  });

  return {
    ok: true,
    guestId,
    message: "Guest PII successfully anonymized. Financial audit integrity preserved.",
  };
}
