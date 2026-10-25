import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requirePermission("ai.operate");
    const executions = await prisma.aiAgentExecution.findMany({
      where: { organizationId: user.organizationId ?? "" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { toolExecutions: true, user: { select: { email: true, name: true } } },
    });
    return NextResponse.json({ success: true, data: executions });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load executions" } }, { status: 500 });
  }
}
