import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("rooms.view");
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const rooms = await prisma.room.findMany({
      where: {
        propertyId: propertyId ?? undefined,
        property: { organizationId: user.organizationId ?? undefined },
      },
      orderBy: { number: "asc" },
      include: { roomType: { select: { id: true, name: true, capacity: true, baseRate: true } } },
    });
    return NextResponse.json({ success: true, data: rooms });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load rooms" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("rooms.manage");
    const body = await request.json();
    const room = await prisma.room.create({
      data: {
        propertyId: body.propertyId,
        roomTypeId: body.roomTypeId,
        number: body.number,
        name: body.name,
        floor: body.floor,
        status: body.status ?? "available",
      },
    });
    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create room" } }, { status: 400 });
  }
}
