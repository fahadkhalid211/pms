import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/audit";

const updateGuestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").optional(),
  lastName: z.string().trim().min(1, "Last name is required").optional(),
  email: z.string().trim().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("guests.view");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const guest = await prisma.guest.findFirst({
      where: { id, organizationId },
      include: {
        profile: true,
        reservations: {
          include: {
            property: { select: { id: true, name: true, code: true, currency: true } },
            rooms: { include: { room: { select: { id: true, number: true, name: true } } } },
            invoices: { select: { id: true, number: true, status: true, total: true } },
          },
          orderBy: { checkIn: "desc" },
        },
        requests: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ success: false, error: { message: "Guest not found." } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: guest });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load guest" } }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePermission("guests.create");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const existing = await prisma.guest.findFirst({ where: { id, organizationId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: { message: "Guest not found." } }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateGuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid guest details" } },
        { status: 400 },
      );
    }

    const updated = await prisma.guest.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.firstName !== undefined ? { firstName: parsed.data.firstName } : {}),
        ...(parsed.data.lastName !== undefined ? { lastName: parsed.data.lastName } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email === "" ? null : parsed.data.email } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
      },
    });

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "operations",
      action: "guest.updated",
      summary: `Updated guest profile for ${updated.firstName} ${updated.lastName}.`,
      entityType: "Guest",
      entityId: updated.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to update guest" } }, { status: 400 });
  }
}
