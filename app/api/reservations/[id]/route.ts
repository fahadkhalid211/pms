import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const UpdateReservationSchema = z.object({
  status: z.enum(["draft", "pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"]).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomIds: z.array(z.string().min(1)).optional(),
  adults: z.coerce.number().int().min(1).optional(),
  children: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
  cancelledReason: z.string().optional().nullable(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("reservations.view");
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const reservation = await dal.reservations.findUnique({ organizationId: user.organizationId }, id);
    return NextResponse.json({ success: true, data: reservation });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 404);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch reservation" } }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("reservations.update", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const updated = await dal.reservations.update(
      { organizationId: user.organizationId },
      id,
      parsed.data,
      user.id,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update reservation" } }, { status });
  }
}
