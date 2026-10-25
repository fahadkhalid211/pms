import { prisma } from "@/lib/db";
import { NotificationChannel, NotificationStatus, Prisma } from "@prisma/client";

export interface CreateNotificationInput {
  organizationId: string;
  propertyId?: string | null;
  userId?: string | null;
  type: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  toEmail?: string | null;
  toPhone?: string | null;
  payload?: Record<string, unknown> | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId ?? undefined,
        userId: input.userId ?? undefined,
        type: input.type,
        channel: input.channel ?? "in_app",
        status: input.status ?? "pending",
        toEmail: input.toEmail ?? undefined,
        toPhone: input.toPhone ?? undefined,
        payload: (input.payload ? JSON.parse(JSON.stringify(input.payload)) : undefined) as Prisma.InputJsonValue | undefined,
        relatedType: input.relatedType ?? undefined,
        relatedId: input.relatedId ?? undefined,
      },
    });
  } catch (error) {
    console.error("[notifications] Failed to record notification:", error);
    return null;
  }
}
