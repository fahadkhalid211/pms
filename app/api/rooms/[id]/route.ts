import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { dal, NotFoundError, CrossTenantViolationError } from "@/lib/dal";
import { InvalidOperationError } from "@/lib/operations";
import { RoomStatus } from "@prisma/client";
import { z } from "zod";

const updateRoomSchema = z.object({
  name: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  roomTypeId: z.string().optional(),
  status: z.enum(["available", "occupied", "dirty", "clean", "inspected", "out_of_service"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("rooms.view");
    const organizationId = user.organizationId!;

    const room = await dal.rooms.findUnique(
      { organizationId },
      id,
    );

    const [reservationRooms, housekeepingTasks, maintenanceTickets] = await Promise.all([
      prisma.reservationRoom.findMany({
        where: { organizationId, roomId: id },
        include: {
          reservation: {
            include: {
              guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { reservation: { checkIn: "desc" } },
        take: 50,
      }),
      prisma.housekeepingTask.findMany({
        where: { organizationId, roomId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.maintenanceTicket.findMany({
        where: { organizationId, roomId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...room,
        reservations: reservationRooms.map((rr) => rr.reservation),
        housekeepingTasks,
        maintenanceTickets,
      },
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 404 });
    }
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load room" } }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("rooms.manage");

    const body = await request.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid payload", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    if (parsed.data.status) {
      const updated = await dal.operations.updateRoomStatus(
        { organizationId: user.organizationId! },
        id,
        parsed.data.status as RoomStatus,
        user.id,
      );
      return NextResponse.json({ success: true, data: updated });
    }

    const updated = await dal.rooms.update(
      { organizationId: user.organizationId! },
      id,
      {
        name: parsed.data.name,
        floor: parsed.data.floor,
        ...(parsed.data.roomTypeId ? { roomType: { connect: { id: parsed.data.roomTypeId } } } : {}),
      },
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
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
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update room" } }, { status });
  }
}
