import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getReservation } from "@/lib/reservations";
import { auditLog } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("reservations.view");
    const { id } = await params;
    const reservation = await getReservation(id, user.organizationId ?? "");
    return NextResponse.json({ success: true, data: reservation });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load reservation" } }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("reservations.update");
    const { id } = await params;
    const body = await request.json();
    const reservation = await prisma.reservation.findFirst({ where: { id, organizationId: user.organizationId ?? "" } });
    if (!reservation) return NextResponse.json({ success: false, error: { message: "Reservation not found." } }, { status: 404 });

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: body.status,
        checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
        checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
        adults: body.adults,
        children: body.children,
        notes: body.notes,
        cancelledAt: body.status === "cancelled" ? new Date() : reservation.cancelledAt,
        cancelledReason: body.status === "cancelled" ? body.cancelledReason : reservation.cancelledReason,
      },
    });

    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      propertyId: reservation.propertyId,
      action: "reservation.updated",
      entityType: "Reservation",
      entityId: reservation.id,
      metadata: { status: updated.status, code: updated.code },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update reservation" } }, { status: 500 });
  }
}
