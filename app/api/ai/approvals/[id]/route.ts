import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { approveAiExecution, rejectAiExecution } from "@/lib/ai/agent";

const resolveApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.approve");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const { id } = await params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Allow empty body defaulting to approve for convenience if callers don't pass JSON
      body = { action: "approve" };
    }

    const parsed = resolveApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid approval action." } },
        { status: 400 },
      );
    }

    if (parsed.data.action === "approve") {
      const result = await approveAiExecution({
        approvalId: id,
        approver: {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKey: user.roleKey,
          organizationId,
          propertyIds: user.propertyIds ?? [],
          permissions: user.permissions,
        },
        comment: parsed.data.reason,
      });
      return NextResponse.json({ success: true, data: result });
    } else {
      const result = await rejectAiExecution({
        approvalId: id,
        approver: {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKey: user.roleKey,
          organizationId,
          propertyIds: user.propertyIds ?? [],
          permissions: user.permissions,
        },
        reason: parsed.data.reason,
      });
      return NextResponse.json({ success: true, data: result });
    }
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to resolve approval request" } }, { status: 500 });
  }
}
