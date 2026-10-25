import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getTool } from "@/lib/ai/tools";
import { auditLog } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.operate");
    const { id } = await params;
    const approval = await prisma.approvalRequest.findFirst({
      where: { id, organizationId: user.organizationId ?? "" },
      include: { execution: true, toolExecutions: true },
    });
    if (!approval) return NextResponse.json({ success: false, error: { message: "Approval not found." } }, { status: 404 });
    if (approval.status !== "pending") {
      return NextResponse.json({ success: false, error: { message: `Approval already ${approval.status}.` } }, { status: 400 });
    }
    const tool = getTool(approval.toolName);
    if (!tool) return NextResponse.json({ success: false, error: { message: "Tool no longer available." } }, { status: 404 });

    const details = approval.details as Record<string, unknown> | null;
    const propertyId = typeof details?.propertyId === "string" ? details.propertyId : undefined;
    const toolArgs = (details?.args ?? {}) as Record<string, unknown>;

    const result = await tool.run(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKey: user.roleKey,
          organizationId: user.organizationId,
          propertyIds: [],
          permissions: user.permissions,
        },
        actorUserId: user.id,
        organizationId: user.organizationId ?? "",
        propertyId,
      },
      toolArgs,
    );

    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: "executed", decidedBy: user.id, decidedAt: new Date() },
    });
    const toolExecution = approval.toolExecutions?.[0];
    if (toolExecution) {
      await prisma.aiToolExecution.update({
        where: { id: toolExecution.id },
        data: { status: "succeeded", output: result.content, updatedAt: new Date() },
      });
    }
    if (approval.executionId) {
      await prisma.aiAgentExecution.update({
        where: { id: approval.executionId },
        data: { status: "completed", finalSummary: result.content, finishedAt: new Date() },
      });
    }
    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: "ai.approval_executed",
      entityType: "ApprovalRequest",
      entityId: approval.id,
      metadata: { toolName: approval.toolName },
    });
    return NextResponse.json({ success: true, data: { ok: true, result } });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to execute approved action" } }, { status: 500 });
  }
}
