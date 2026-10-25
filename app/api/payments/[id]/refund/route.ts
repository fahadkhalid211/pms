import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const refundSchema = z.object({
  amount: z.number().positive("Refund amount must be positive"),
  reason: z.string().optional().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rawBody = await request.json();
    const parsed = refundSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid refund payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("billing.manage");

    const refund = await dal.refunds.request(
      { organizationId: user.organizationId! },
      {
        paymentId: id,
        amount: parsed.data.amount,
        reason: parsed.data.reason ?? undefined,
      },
      user.id,
    );

    return NextResponse.json({ success: true, data: refund }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to request refund" } },
      { status },
    );
  }
}
