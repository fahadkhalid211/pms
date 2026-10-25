import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("maintenance.manage");
    const { id } = await params;
    const ticket = await prisma.maintenanceTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ success: false, error: { message: "Ticket not found." } }, { status: 404 });

    const property = await prisma.property.findFirst({
      where: { id: ticket.propertyId, organizationId: user.organizationId ?? "" },
    });
    if (!property) return NextResponse.json({ success: false, error: { message: "Ticket not found." } }, { status: 404 });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load ticket" } }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("maintenance.manage");
    const { id } = await params;
    const ticket = await prisma.maintenanceTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ success: false, error: { message: "Ticket not found." } }, { status: 404 });

    const property = await prisma.property.findFirst({
      where: { id: ticket.propertyId, organizationId: user.organizationId ?? "" },
    });
    if (!property) return NextResponse.json({ success: false, error: { message: "Ticket not found." } }, { status: 404 });

    const body = (await request.json()) as {
      status?: string;
      priority?: string;
      assigneeId?: string;
    };
    const updated = await prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: typeof body.status === "string" ? body.status : undefined,
        priority: typeof body.priority === "string" ? body.priority : undefined,
        assigneeId: typeof body.assigneeId === "string" ? body.assigneeId : undefined,
        resolvedAt: body.status === "resolved" ? new Date() : undefined,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to update ticket" } }, { status: 500 });
  }
}
