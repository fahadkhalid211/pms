import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal, NotFoundError, CrossTenantViolationError } from "@/lib/dal";
import { DoubleBookingConflictError } from "@/lib/reservations";
import { RoomNotReadyError, InvalidOperationError } from "@/lib/operations";
import { z } from "zod";

const reassignRoomSchema = z.object({
  currentRoomId: z.string().min(1, "currentRoomId is required"),
  targetRoomId: z.string().min(1, "targetRoomId is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("reservations.update");

    const body = await request.json();
    const parsed = reassignRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid payload", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const updated = await dal.operations.reassignRoom(
      { organizationId: user.organizationId! },
      id,
      parsed.data.currentRoomId,
      parsed.data.targetRoomId,
      user.id,
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DoubleBookingConflictError) {
      return NextResponse.json(
        { success: false, error: { code: "DOUBLE_BOOKING_CONFLICT", message: error.message } },
        { status: 409 },
      );
    }
    if (error instanceof RoomNotReadyError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ROOM_NOT_READY",
            message: error.message,
            roomNumber: error.roomNumber,
            roomStatus: error.roomStatus,
          },
        },
        { status: 409 },
      );
    }
    if (error instanceof InvalidOperationError) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_OPERATION", message: error.message } },
        { status: 400 },
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 404 });
    }
    if (error instanceof CrossTenantViolationError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    }

    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Room reassignment failed" } }, { status });
  }
}
