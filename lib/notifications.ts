export * from "./notifications/types";
export * from "./notifications/templates";
export * from "./notifications/providers";
export * from "./notifications/preferences";
export * from "./notifications/queue";
export * from "./notifications/reminders";

// Backward-compatible createNotification helper
import { enqueueNotification, TenantContext } from "./notifications/queue";

export async function createNotification(input: {
  organizationId: string;
  propertyId?: string | null;
  userId?: string | null;
  type: string;
  channel?: any;
  status?: any;
  toEmail?: string | null;
  toPhone?: string | null;
  payload?: any;
  relatedType?: string | null;
  relatedId?: string | null;
  title?: string;
  message?: string;
}) {
  const ctx: TenantContext = {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
  };

  return enqueueNotification(ctx, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    userId: input.userId,
    type: input.type,
    channel: input.channel ?? "in_app",
    toEmail: input.toEmail,
    toPhone: input.toPhone,
    relatedType: input.relatedType,
    relatedId: input.relatedId,
    payload: input.payload,
    variables: {
      title: input.title,
      message: input.message,
    },
  });
}
