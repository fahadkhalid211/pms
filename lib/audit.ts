import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function auditLog(input: {
  userId?: string | null;
  organizationId?: string | null;
  propertyId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        organizationId: input.organizationId ?? undefined,
        propertyId: input.propertyId ?? undefined,
        action: input.action,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonObject | undefined,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to write audit log:", error);
  }
}
