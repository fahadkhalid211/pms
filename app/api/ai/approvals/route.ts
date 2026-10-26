import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("ai.operate");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const approvals = await prisma.approvalRequest.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        execution: { select: { id: true, requestSummary: true, status: true } },
        toolExecutions: { select: { id: true, toolName: true, status: true, input: true } },
      },
    });

    return NextResponse.json({ success: true, data: approvals });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load approvals" } }, { status: 500 });
  }
}
