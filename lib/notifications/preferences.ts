import { prisma } from "@/lib/db";
import { NotificationChannel } from "@prisma/client";
import { RecipientPreferences } from "./types";

export const DEFAULT_PREFERENCES: RecipientPreferences = {
  emailEnabled: true,
  smsEnabled: true,
  preArrivalReminders: true,
  checkInReminders: true,
  checkOutReminders: true,
  paymentReminders: true,
  marketingEmails: false,
};

export async function getRecipientPreferences(recipient: {
  guestId?: string | null;
  userId?: string | null;
  organizationId: string;
}): Promise<RecipientPreferences> {
  if (recipient.guestId) {
    const profile = await prisma.guestProfile.findFirst({
      where: {
        guestId: recipient.guestId,
        organizationId: recipient.organizationId,
      },
    });

    if (profile && profile.preferences && typeof profile.preferences === "object") {
      const stored = profile.preferences as Record<string, unknown>;
      return {
        emailEnabled: stored.emailEnabled !== false,
        smsEnabled: stored.smsEnabled !== false,
        preArrivalReminders: stored.preArrivalReminders !== false,
        checkInReminders: stored.checkInReminders !== false,
        checkOutReminders: stored.checkOutReminders !== false,
        paymentReminders: stored.paymentReminders !== false,
        marketingEmails: Boolean(stored.marketingEmails),
      };
    }
  }

  return { ...DEFAULT_PREFERENCES };
}

export async function updateGuestPreferences(
  organizationId: string,
  guestId: string,
  updates: Partial<RecipientPreferences>,
): Promise<RecipientPreferences> {
  const existing = await getRecipientPreferences({ organizationId, guestId });
  const merged: RecipientPreferences = {
    ...existing,
    ...updates,
  };

  await prisma.guestProfile.upsert({
    where: { guestId },
    create: {
      organizationId,
      guestId,
      preferences: merged as any,
    },
    update: {
      preferences: merged as any,
    },
  });

  return merged;
}

export function shouldDeliverNotification(
  preferences: RecipientPreferences,
  channel: NotificationChannel,
  notificationType: string,
): { allowed: boolean; reason?: string } {
  if (channel === "email" && !preferences.emailEnabled) {
    return { allowed: false, reason: "Recipient has disabled email notifications." };
  }

  if (channel === "sms" && !preferences.smsEnabled) {
    return { allowed: false, reason: "Recipient has disabled SMS notifications." };
  }

  if (notificationType === "pre_arrival" && !preferences.preArrivalReminders) {
    return { allowed: false, reason: "Recipient has opted out of pre-arrival reminders." };
  }

  if (notificationType === "check_in_welcome" && !preferences.checkInReminders) {
    return { allowed: false, reason: "Recipient has opted out of check-in notifications." };
  }

  if (notificationType === "check_out_thanks" && !preferences.checkOutReminders) {
    return { allowed: false, reason: "Recipient has opted out of checkout communications." };
  }

  if (notificationType === "payment_reminder" && !preferences.paymentReminders) {
    return { allowed: false, reason: "Recipient has opted out of automated payment reminders." };
  }

  return { allowed: true };
}
