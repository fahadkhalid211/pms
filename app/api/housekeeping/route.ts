import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("housekeeping.view");
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const status = url.searchParams.get("status");
    const where: any = { property: { organizationId: user.organizationId ?? "" } };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    const tasks = await prisma.housekeepingTask.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: { room: { include: { roomType: true } } },
    });
    return NextResponse.json({ success: true, data: tasks });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load tasks" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("housekeeping.manage");
    const body = await request.json();
    const task = await prisma.housekeepingTask.create({
      data: {
        propertyId: body.propertyId,
        roomId: body.roomId,
        status: body.status ?? "pending",
        priority: body.priority ?? "normal",
        title: body.title,
        notes: body.notes,
        assigneeId: body.assigneeId,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
    });
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create task" } }, { status: 400 });
  }
}
