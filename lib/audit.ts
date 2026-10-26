import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export type ActivitySource = "frontend" | "backend";
export type ActivityCategory =
  | "auth"
  | "reservation"
  | "billing"
  | "operations"
  | "housekeeping"
  | "maintenance"
  | "ai"
  | "notifications"
  | "navigation"
  | "ui_action"
  | "system";

export interface LogActivityInput {
  organizationId?: string | null;
  propertyId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  source: ActivitySource;
  category: ActivityCategory;
  action: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: Date;
}

// Redact sensitive patterns from metadata before logging
function redactSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);

  const sensitiveKeys = [
    "password",
    "passwordHash",
    "token",
    "secret",
    "apiKey",
    "creditCard",
    "cardNumber",
    "cvv",
    "authorization",
    "cookie",
  ];

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Universal Activity & Audit Logger
 * Logs events happening in both frontend and backend with timestamp, user details, and summary.
 */
export async function logActivity(input: LogActivityInput) {
  try {
    const timestamp = input.timestamp ?? new Date();
    const sanitizedMetadata = {
      ...(input.metadata ? (redactSensitiveData(input.metadata) as Record<string, unknown>) : {}),
      summary: input.summary,
      source: input.source,
      category: input.category,
      userName: input.userName ?? undefined,
      userEmail: input.userEmail ?? undefined,
      userRole: input.userRole ?? undefined,
      loggedAt: timestamp.toISOString(),
    };

    return await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? undefined,
        propertyId: input.propertyId ?? undefined,
        userId: input.userId ?? undefined,
        action: input.action,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        metadata: sanitizedMetadata as Prisma.InputJsonObject,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : undefined,
        createdAt: timestamp,
      },
    });
  } catch (error) {
    // Audit logging is non-blocking so failures never crash transactions
    console.error("[Universal Logger] Failed to record activity log:", error);
    return null;
  }
}

// Backward-compatible alias for existing call sites
export async function auditLog(input: {
  userId?: string | null;
  organizationId?: string | null;
  propertyId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const summary = (input.metadata?.summary as string) || `Action executed: ${input.action}`;
  return logActivity({
    ...input,
    source: "backend",
    category: "system",
    summary,
  });
}
