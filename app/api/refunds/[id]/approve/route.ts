import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const approveRefundSchema = z.object({
  gatewayRef: z.string().optional().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let gatewayRef: string | undefined;

    // Optional body
    try {
      const rawBody = await request.json();
      const parsed = approveRefundSchema.safeParse(rawBody);
      if (parsed.success) {
        gatewayRef = parsed.data.gatewayRef ?? undefined;
      }
    } catch {
      // Body is optional
    }

    const user = await requirePermission("billing.manage");

    const approvedRefund = await dal.refunds.approve(
      { organizationId: user.organizationId! },
      {
        refundId: id,
        gatewayRef,
      },
      user.id,
    );

    return NextResponse.json({ success: true, data: approvedRefund });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to approve refund" } },
      { status },
    );
  }
}
