import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const updatePropertySchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).max(16).optional(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  checkInTime: z.number().int().min(0).max(23).optional(),
  checkOutTime: z.number().int().min(0).max(23).optional(),
  taxRate: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("properties.view", { propertyId: id });
    const organizationId = user.organizationId!;
    const property = await dal.properties.findUnique({ organizationId }, id);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [rooms, reservations, memberships, integrations, housekeepingTasks, maintenanceTickets] = await Promise.all([
      prisma.room.findMany({
        where: { organizationId, propertyId: id },
        include: { roomType: { select: { id: true, name: true, baseRate: true, capacity: true } } },
        orderBy: { number: "asc" },
      }),
      prisma.reservation.findMany({
        where: { organizationId, propertyId: id },
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          rooms: { include: { room: { select: { id: true, number: true, name: true } } } },
          invoices: { select: { id: true, number: true, status: true, total: true } },
        },
        orderBy: { checkIn: "desc" },
        take: 100,
      }),
      prisma.propertyMembership.findMany({
        where: { organizationId, propertyId: id },
        include: {
          user: { select: { id: true, name: true, email: true, roleKey: true, status: true } },
        },
      }),
      prisma.integration.findMany({
        where: {
          organizationId,
          OR: [{ propertyId: id }, { provider: "hospitable" }],
        },
        select: {
          id: true,
          provider: true,
          name: true,
          status: true,
          lastSyncAt: true,
          lastError: true,
          propertyId: true,
        },
      }),
      prisma.housekeepingTask.findMany({
        where: { organizationId, propertyId: id },
        include: { room: { select: { id: true, number: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.maintenanceTicket.findMany({
        where: { organizationId, propertyId: id },
        include: { room: { select: { id: true, number: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    const legacyRooms = rooms.filter((r) => r.number === "MAIN" || (r.name && /[\s_-]+MAIN$/i.test(r.name)));
    if (legacyRooms.length > 0) {
      await Promise.all(
        legacyRooms.map(async (r) => {
          const cleanName = (r.name || property.name || "Main Unit").replace(/[\s_-]+MAIN$/i, "").trim();
          const cleanNumber = cleanName.length <= 50 ? cleanName : cleanName.slice(0, 50);
          try {
            await prisma.room.update({
              where: { id: r.id },
              data: {
                number: r.number === "MAIN" ? cleanNumber : r.number,
                name: cleanName,
              },
            });
            if (r.number === "MAIN") r.number = cleanNumber;
            r.name = cleanName;
          } catch {
            // Ignore if duplicate
          }
        }),
      );
    }

    let totalRevenue = new Prisma.Decimal(0);
    let upcomingBookings = 0;
    let checkedInNow = 0;

    for (const r of reservations) {
      if (r.status !== "cancelled" && r.status !== "no_show") {
        totalRevenue = totalRevenue.add(new Prisma.Decimal(r.totalAmount));
      }
      if ((r.status === "confirmed" || r.status === "pending") && new Date(r.checkOut) >= today) {
        upcomingBookings += 1;
      }
      if (r.status === "checked_in") {
        checkedInNow += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...property,
        rooms,
        reservations,
        memberships,
        integrations,
        housekeepingTasks,
        maintenanceTickets,
        metrics: {
          totalBookings: reservations.length,
          upcomingBookings,
          checkedInNow,
          totalRooms: rooms.length,
          totalRevenue: totalRevenue.toFixed(2),
          openHousekeeping: housekeepingTasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
          openMaintenance: maintenanceTickets.filter((t) => t.status === "open" || t.status === "in_progress").length,
        },
      },
    });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch property" } }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("properties.manage", { propertyId: id });
    const rawBody = await request.json();
    const parsed = updatePropertySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid property payload" } },
        { status: 400 },
      );
    }

    const cleanData = {
      ...parsed.data,
      email: parsed.data.email === "" ? null : parsed.data.email,
    };

    const updated = await dal.properties.update(
      { organizationId: user.organizationId! },
      id,
      cleanData as any,
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update property" } }, { status });
  }
}
