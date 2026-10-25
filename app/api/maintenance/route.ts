import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("maintenance.manage");
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const status = url.searchParams.get("status");
    const where: any = { property: { organizationId: user.organizationId ?? "" } };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    const tickets = await prisma.maintenanceTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { room: { include: { roomType: true } } },
    });
    return NextResponse.json({ success: true, data: tickets });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load tickets" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("maintenance.manage");
    const body = await request.json();
    const ticket = await prisma.maintenanceTicket.create({
      data: {
        organizationId: user.organizationId!,
        propertyId: body.propertyId,
        roomId: body.roomId,
        status: body.status ?? "open",
        priority: body.priority ?? "normal",
        description: body.description,
        assigneeId: body.assigneeId,
      },
    });
    return NextResponse.json({ success: true, data: ticket }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create ticket" } }, { status: 400 });
  }
}
