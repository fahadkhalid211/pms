import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requirePermission("ai.operate");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const executions = await prisma.aiAgentExecution.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        toolExecutions: true,
        user: { select: { email: true, name: true } },
        approvals: { select: { id: true, status: true, toolName: true, summary: true } },
      },
    });

    return NextResponse.json({ success: true, data: executions });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load executions" } }, { status: 500 });
  }
}
