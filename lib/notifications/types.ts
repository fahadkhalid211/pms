import { NotificationChannel } from "@prisma/client";

export interface PropertyBrand {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  brandColor?: string;
}

export interface DeliveryLogEntry {
  id: string;
  provider: string; // e.g. "resend" | "smtp" | "mock"
  providerRef?: string; // MessageId or API transaction ID
  status: "sent" | "failed";
  durationMs: number;
  error?: string;
  timestamp: string;
}

export interface NotificationJobPayload {
  templateCode?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  variables?: Record<string, string | number | boolean | null | undefined>;
  attempts?: number;
  maxAttempts?: number;
  runAt?: string;
  lastAttemptAt?: string;
  deliveryLogs?: DeliveryLogEntry[];
  brand?: PropertyBrand;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

export interface RecipientPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  preArrivalReminders: boolean;
  checkInReminders: boolean;
  checkOutReminders: boolean;
  paymentReminders: boolean;
  marketingEmails: boolean;
}

export interface EnqueueNotificationInput {
  organizationId: string;
  propertyId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  channel?: NotificationChannel;
  type: string;
  toEmail?: string | null;
  toPhone?: string | null;
  subject?: string;
  templateCode?: string;
  variables?: Record<string, string | number | boolean | null | undefined>;
  payload?: NotificationJobPayload;
  relatedType?: string | null;
  relatedId?: string | null;
  scheduledFor?: Date | null;
  maxAttempts?: number;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailOutput {
  provider: string;
  providerRef: string;
  status: "sent" | "failed";
  durationMs: number;
  error?: string;
  sentAt: Date;
}

export interface EmailProviderAdapter {
  readonly name: string;
  sendEmail(input: SendEmailInput): Promise<SendEmailOutput>;
}
