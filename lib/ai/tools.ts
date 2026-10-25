import { prisma } from "@/lib/db";
import { createReservation, nightsBetween } from "@/lib/reservations";
import { auditLog } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";

export interface ToolContext {
  user: SessionUser;
  actorUserId: string;
  organizationId: string;
  propertyId?: string | null;
}

export interface ToolResult {
  content: string;
  approved?: boolean;
}

export interface AiTool {
  name: string;
  description: string;
  requiresPermission?: string;
  requiresApproval?: boolean;
  run: (ctx: ToolContext, args: Record<string, any>) => Promise<ToolResult>;
}

const tools: AiTool[] = [
  {
    name: "search_reservations",
    description: "Search reservations by booking code, guest name, status, or date range.",
    requiresPermission: "reservations.view",
    run: async (ctx, args) => {
      const where: any = { organizationId: ctx.organizationId };
      if (args.status) where.status = args.status;
      if (args.query) {
        where.OR = [
          { code: { contains: String(args.query) } },
          { guest: { firstName: { contains: String(args.query) } } },
        ];
      }
      const reservations = await prisma.reservation.findMany({
        where,
        orderBy: { checkIn: "asc" },
        take: 20,
        include: { property: { select: { name: true } }, guest: { select: { firstName: true, lastName: true } } },
      });
      return { content: `Found ${reservations.length} reservations.`, ...(await maybeScopeByProperty(ctx, reservations)) };
    },
  },
  {
    name: "check_availability",
    description: "Check room availability for a set of room IDs or all rooms of a property between two dates.",
    requiresPermission: "rooms.view",
    run: async (ctx, args) => {
      const propertyId = args.propertyId;
      const checkIn = new Date(args.checkIn);
      const checkOut = new Date(args.checkOut);
      const nights = nightsBetween(checkIn, checkOut);
      const rooms = await prisma.room.findMany({
        where: { propertyId, status: "available" },
        include: { roomType: true },
      });
      const conflicts: string[] = [];
      for (const room of rooms) {
        const conflict = await prisma.reservationRoom.findFirst({
          where: {
            roomId: room.id,
            reservation: { organizationId: ctx.organizationId, propertyId, status: { in: ["pending", "confirmed", "checked_in"] } },
          },
          include: { reservation: { select: { checkIn: true, checkOut: true, status: true, code: true } } },
        });
        const overlaps = conflict ? checkIn < conflict.reservation.checkIn || checkOut > conflict.reservation.checkOut : false;
        const bad = conflict ? checkIn < conflict.reservation.checkOut && checkOut > conflict.reservation.checkIn : false;
        if (conflict && checkIn < conflict.reservation.checkOut && checkOut > conflict.reservation.checkIn) conflicts.push(room.id);
      }
      const availableRoomIds = rooms.filter((r) => !conflicts.includes(r.id)).map((r) => r.id);
      return {
        content: `Availability checked for ${nights} night(s). ${availableRoomIds.length} room(s) available, ${conflicts.length} conflicted.`,
      };
    },
  },
  {
    name: "create_reservation",
    description: "Create a new reservation for a property and rooms.",
    requiresPermission: "reservations.create",
    requiresApproval: true,
    run: async (ctx, args) => {
      const created = await createReservation({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        roomIds: args.roomIds ?? [],
        checkIn: new Date(args.checkIn),
        checkOut: new Date(args.checkOut),
        adults: args.adults ?? 2,
        children: args.children ?? 0,
        guestId: args.guestId ?? null,
        source: args.source ?? "agent",
        notes: args.notes,
        status: args.status ?? "confirmed",
      });
      await auditLog({
        userId: ctx.actorUserId,
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        action: "ai.reservation_created",
        entityType: "Reservation",
        entityId: created.reservation.id,
        metadata: { code: created.reservation.code },
      });
      return { content: `Reservation ${created.reservation.code} created for ${created.rooms.length} room(s).`, approved: args.status !== "confirmed" };
    },
  },
  {
    name: "check_in_reservation",
    description: "Mark a reservation as checked in.",
    requiresPermission: "frontdesk.checkin",
    run: async (ctx, args) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: args.reservationId, organizationId: ctx.organizationId },
        include: { rooms: true },
      });
      if (!reservation) return { content: "Reservation not found." };
      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "checked_in" },
      });
      for (const rr of reservation.rooms) {
        await prisma.room.update({ where: { id: rr.roomId }, data: { status: "occupied" } });
      }
      return { content: `Checked in reservation ${updated.code}. Rooms marked occupied.` };
    },
  },
  {
    name: "check_out_reservation",
    description: "Mark a reservation as checked out and release rooms.",
    requiresPermission: "frontdesk.checkout",
    run: async (ctx, args) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: args.reservationId, organizationId: ctx.organizationId },
      });
      if (!reservation) return { content: "Reservation not found." };
      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "checked_out" },
      });
      const roomLinks = await prisma.reservationRoom.findMany({ where: { reservationId: reservation.id } });
      for (const link of roomLinks) {
        await prisma.room.update({ where: { id: link.roomId }, data: { status: "dirty" } });
      }
      return { content: `Checked out reservation ${updated.code}. Rooms released to dirty.` };
    },
  },
  {
    name: "search_guests",
    description: "Search guest profiles by name or email.",
    requiresPermission: "guests.view",
    run: async (ctx, args) => {
      const guests = await prisma.guest.findMany({
        where: {
          organizationId: ctx.organizationId,
          OR: [
            { firstName: { contains: String(args.query ?? "") } },
            { lastName: { contains: String(args.query ?? "") } },
          ],
        },
        take: 10,
      });
      return { content: `Found ${guests.length} guest(s).` };
    },
  },
  {
    name: "create_housekeeping_task",
    description: "Create a housekeeping task for a room.",
    requiresPermission: "housekeeping.manage",
    run: async (ctx, args) => {
      const room = await prisma.room.findFirst({
        where: { id: args.roomId, organizationId: ctx.organizationId, propertyId: args.propertyId },
      });
      if (!room) return { content: `Error: Room ${args.roomId} not found in your property.` };

      await prisma.housekeepingTask.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: args.propertyId,
          roomId: args.roomId,
          status: "pending",
          priority: args.priority ?? "normal",
          title: args.title ?? "Cleaning",
          notes: args.notes,
          dueAt: args.dueInHours ? new Date(Date.now() + Number(args.dueInHours) * 3600000) : undefined,
        },
      });
      return { content: `Housekeeping task created for room ${args.roomId}.` };
    },
  },
  {
    name: "update_room_status",
    description: "Update a room status (available, occupied, dirty, clean, inspected, out_of_service).",
    requiresPermission: "rooms.manage",
    run: async (ctx, args) => {
      const room = await prisma.room.findFirst({
        where: { id: args.roomId, organizationId: ctx.organizationId },
      });
      if (!room) return { content: `Error: Room ${args.roomId} not found in your organization.` };

      const updated = await prisma.room.update({
        where: { id: room.id },
        data: { status: args.status },
      });
      return { content: `Room ${updated.number} status set to ${updated.status}.` };
    },
  },
  {
    name: "create_maintenance_ticket",
    description: "Create a maintenance ticket for a room.",
    requiresPermission: "maintenance.manage",
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({
        where: { id: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) return { content: `Error: Property ${args.propertyId} not found in your organization.` };

      if (args.roomId) {
        const room = await prisma.room.findFirst({
          where: { id: args.roomId, organizationId: ctx.organizationId, propertyId: args.propertyId },
        });
        if (!room) return { content: `Error: Room ${args.roomId} not found in your property.` };
      }

      const ticket = await prisma.maintenanceTicket.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: args.propertyId,
          roomId: args.roomId,
          status: "open",
          priority: args.priority ?? "normal",
          description: args.description,
        },
      });
      return { content: `Maintenance ticket ${ticket.id} created.` };
    },
  },
  {
    name: "get_invoices",
    description: "List invoices and payment status for a property or organization.",
    requiresPermission: "billing.view",
    run: async (ctx, args) => {
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: ctx.organizationId, ...(args.propertyId ? { propertyId: args.propertyId } : {}) },
        take: 20,
      });
      const outstanding = invoices.filter((i) => ["issued", "overdue"].includes(i.status));
      const total = outstanding.reduce((acc, i) => acc + Number(i.total), 0);
      return { content: `Found ${invoices.length} invoices, ${outstanding.length} outstanding totalling ${total}.` };
    },
  },
  {
    name: "generate_report",
    description: "Generate an operational summary report (occupancy, revenue, ADR, RevPAR).",
    requiresPermission: "reports.view",
    run: async (ctx, args) => {
      const propertyId = args.propertyId;
      const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: ctx.organizationId } });
      const rooms = await prisma.room.findMany({ where: { propertyId }, select: { id: true, status: true } });
      const occupied = rooms.filter((r) => r.status === "occupied").length;
      const reservations = await prisma.reservation.findMany({
        where: { organizationId: ctx.organizationId, propertyId, status: "confirmed" },
        include: { rooms: true },
      });
      const revenue = await prisma.payment.aggregate({
        where: { organizationId: ctx.organizationId, propertyId, status: "captured" },
        _sum: { amount: true },
      });
      return {
        content: `Report generated: ${rooms.length} rooms, ${occupied} occupied, confirmed revenue ${revenue._sum.amount ?? 0}.`,
      };
    },
  },
  {
    name: "draft_message",
    description: "Draft a guest communication message based on a reservation.",
    requiresPermission: "reservations.view",
    run: async (ctx, args) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: args.reservationId, organizationId: ctx.organizationId },
        include: { guest: true, property: true, rooms: { include: { room: { include: { roomType: true } } } } },
      });
      const guestName = reservation?.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : "Guest";
      const draft = `Hello ${guestName}, this is a message from ${reservation?.property?.name ?? "the property"}.`;
      return { content: draft };
    },
  },
  {
    name: "get_policies",
    description: "Retrieve property policies and check-in/check-out rules.",
    requiresPermission: "properties.view",
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({ where: { id: args.propertyId, organizationId: ctx.organizationId } });
      const checkInTime = property?.checkInTime ?? 15;
      const checkOutTime = property?.checkOutTime ?? 11;
      const policy = {
        checkInTime,
        checkOutTime,
        taxRate: property?.taxRate,
        cleaningFee: property?.cleaningFee,
        currency: property?.currency,
      };
      return { content: JSON.stringify(policy) };
    },
  },
];

async function maybeScopeByProperty(ctx: ToolContext, reservations: any[]) {
  if (!ctx.propertyId) return reservations;
  return reservations.filter((r) => r.propertyId === ctx.propertyId);
}

export function getTool(name: string) {
  return tools.find((t) => t.name === name);
}

export function toolsForPermissions(user: SessionUser): AiTool[] {
  const allowed = new Set(user.permissions ?? []);
  const all = user.roleKey === "admin" ? tools : tools.filter((t) => (t.requiresPermission ? allowed.has(t.requiresPermission) : true));
  return all;
}

export function toolDefinitions(): { name: string; description: string; inputSchema: Record<string, unknown> }[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "Optional property id" },
        roomId: { type: "string" },
        roomIds: { type: "array", items: { type: "string" } },
        reservationId: { type: "string" },
        checkIn: { type: "string" },
        checkOut: { type: "string" },
        adults: { type: "number" },
        children: { type: "number" },
        guestId: { type: "string" },
        status: { type: "string" },
        source: { type: "string" },
        notes: { type: "string" },
        priority: { type: "string" },
        title: { type: "string" },
        notes2: { type: "string" },
        dueInHours: { type: "number" },
        query: { type: "string" },
        dueAt: { type: "string" },
        description: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        reportType: { type: "string" },
        tone: { type: "string" },
      },
      required: [],
      additionalProperties: true,
    },
  }));
}
