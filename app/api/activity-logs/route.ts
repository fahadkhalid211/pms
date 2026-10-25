import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await requireAuthContext();
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const propertyId = url.searchParams.get("propertyId") ?? undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to load activity logs" } },
      { status },
    );
  }
}
