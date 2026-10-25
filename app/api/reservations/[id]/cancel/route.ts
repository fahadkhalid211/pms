import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CancelReservationSchema = z.object({
  reason: z.string().optional().default("Guest requested cancellation"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("reservations.cancel", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    let reason = "Guest requested cancellation";
    try {
      const body = await request.json();
      const parsed = CancelReservationSchema.safeParse(body);
      if (parsed.success && parsed.data.reason) {
        reason = parsed.data.reason;
      }
    } catch {
      // Empty body is acceptable; use default reason
    }

    const result = await dal.reservations.cancel(
      { organizationId: user.organizationId },
      id,
      reason,
      user.id,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to cancel reservation" } }, { status });
  }
}
