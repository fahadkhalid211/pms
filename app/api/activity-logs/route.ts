import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { logActivity, ActivityCategory } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { z } from "zod";

const postLogSchema = z.object({
  action: z.string().min(1, "Action is required"),
  summary: z.string().min(1, "Summary is required"),
  category: z
    .enum([
      "auth",
      "reservation",
      "billing",
      "operations",
      "housekeeping",
      "maintenance",
      "ai",
      "notifications",
      "navigation",
      "ui_action",
      "system",
    ])
    .default("ui_action"),
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  propertyId: z.string().optional().nullable(),
  clientTimestamp: z.string().datetime().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const url = new URL(request.url);
    const source = url.searchParams.get("source"); // frontend | backend
    const category = url.searchParams.get("category");
    const userId = url.searchParams.get("userId");
    const propertyId = url.searchParams.get("propertyId");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);

    const where: any = {
      organizationId: auth.organizationId,
      ...(propertyId ? { propertyId } : {}),
      ...(userId ? { userId } : {}),
    };

    if (auth.propertyIds?.length && !auth.isOrgAdmin) {
      where.OR = [
        { propertyId: { in: auth.propertyIds } },
        { propertyId: null },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit * 2, // buffer for json filters
    });

    // In-memory filter on Json metadata for source, category, and text search
    const filtered = logs
      .map((log) => {
        const meta = (log.metadata as Record<string, any>) ?? {};
        return {
          id: log.id,
          timestamp: log.createdAt.toISOString(),
          action: log.action,
          summary: (meta.summary as string) || `Action executed: ${log.action}`,
          source: (meta.source as "frontend" | "backend") || "backend",
          category: (meta.category as ActivityCategory) || "system",
          user: log.user ? { id: log.user.id, name: log.user.name, email: log.user.email } : null,
          entityType: log.entityType,
          entityId: log.entityId,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          metadata: meta,
        };
      })
      .filter((log) => {
        if (source && source !== "all" && log.source !== source) return false;
        if (category && category !== "all" && log.category !== category) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchSum = log.summary.toLowerCase().includes(q);
          const matchAct = log.action.toLowerCase().includes(q);
          const matchUser = log.user?.name.toLowerCase().includes(q) || log.user?.email.toLowerCase().includes(q);
          if (!matchSum && !matchAct && !matchUser) return false;
        }
        return true;
      })
      .slice(0, limit);

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to load activity logs" } },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    const parsed = postLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid activity log payload" } },
        { status: 400 },
      );
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const created = await logActivity({
      organizationId: auth?.organizationId ?? undefined,
      propertyId: parsed.data.propertyId ?? undefined,
      userId: auth?.user.id ?? undefined,
      userName: auth?.user.name ?? undefined,
      userEmail: auth?.user.email ?? undefined,
      userRole: auth?.user.roleKey ?? undefined,
      source: "frontend",
      category: parsed.data.category,
      action: parsed.data.action,
      summary: parsed.data.summary,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      metadata: parsed.data.metadata,
      ipAddress: ip,
      userAgent: userAgent ?? undefined,
      timestamp: parsed.data.clientTimestamp ? new Date(parsed.data.clientTimestamp) : new Date(),
    });

    return NextResponse.json({ success: true, data: { id: created?.id } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to record activity log" } },
      { status: 500 },
    );
  }
}
