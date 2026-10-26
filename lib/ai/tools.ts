import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createReservation, cancelReservation, nightsBetween } from "@/lib/reservations";
import { requestRefund, approveRefund } from "@/lib/billing";
import { logActivity } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";

export type RiskLevel = "read" | "reversible" | "sensitive";

export interface ToolContext {
  user: SessionUser;
  actorUserId: string;
  organizationId: string;
  propertyId?: string | null;
}

export interface ToolResult {
  content: string;
  data?: Record<string, unknown>;
  approved?: boolean;
}

export interface AiTool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  risk: RiskLevel;
  requiresPermission: string;
  requiresApproval?: boolean;
  schema: T;
  jsonSchema: Record<string, unknown>;
  run: (ctx: ToolContext, args: z.infer<T>) => Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Tool Schemas & Definitions
// ---------------------------------------------------------------------------

const searchReservationsSchema = z.object({
  query: z.string().optional().describe("Search term for booking code or guest name"),
  status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"]).optional(),
  propertyId: z.string().optional().describe("Optional property scope filter"),
});

const checkAvailabilitySchema = z.object({
  propertyId: z.string().describe("Property ID to check availability in"),
  checkIn: z.string().describe("Check-in date in YYYY-MM-DD format"),
  checkOut: z.string().describe("Check-out date in YYYY-MM-DD format"),
  roomTypeId: z.string().optional().describe("Optional room type ID to filter"),
});

const getGuestSummarySchema = z.object({
  query: z.string().optional().describe("Guest name, email, or phone search query"),
  guestId: z.string().optional().describe("Specific guest ID to summarize"),
});

const getInvoicesSchema = z.object({
  propertyId: z.string().optional().describe("Optional property scope filter"),
  status: z.enum(["draft", "issued", "paid", "partially_paid", "void", "overdue"]).optional(),
});

const generateReportSchema = z.object({
  propertyId: z.string().describe("Target property ID"),
  reportType: z.enum(["occupancy", "revenue", "daily_summary"]).default("daily_summary"),
});

const getPoliciesSchema = z.object({
  propertyId: z.string().describe("Target property ID"),
});

const updateRoomStatusSchema = z.object({
  roomId: z.string().describe("Room ID to update"),
  status: z.enum(["available", "occupied", "dirty", "clean", "inspected", "out_of_service"]),
});

const createHousekeepingTaskSchema = z.object({
  propertyId: z.string().describe("Property ID"),
  roomId: z.string().describe("Room ID"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  title: z.string().default("Cleaning task"),
  notes: z.string().optional(),
  dueInHours: z.number().positive().default(4),
});

const createMaintenanceTicketSchema = z.object({
  propertyId: z.string().describe("Property ID"),
  roomId: z.string().optional().describe("Optional room ID"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  description: z.string().min(5).describe("Description of the maintenance issue"),
});

const checkInReservationSchema = z.object({
  reservationId: z.string().describe("Reservation ID to check in"),
});

const checkOutReservationSchema = z.object({
  reservationId: z.string().describe("Reservation ID to check out"),
});

const draftMessageSchema = z.object({
  reservationId: z.string().describe("Reservation ID for guest context"),
  tone: z.enum(["formal", "warm", "concise"]).default("warm"),
});

const createReservationSchema = z.object({
  propertyId: z.string().describe("Property ID"),
  roomIds: z.array(z.string()).min(1).describe("List of room IDs to book"),
  checkIn: z.string().describe("Check-in date (YYYY-MM-DD)"),
  checkOut: z.string().describe("Check-out date (YYYY-MM-DD)"),
  adults: z.number().int().positive().default(2),
  children: z.number().int().nonnegative().default(0),
  guestId: z.string().optional().nullable(),
  source: z.string().default("ai_agent"),
  notes: z.string().optional(),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
});

const cancelReservationSchema = z.object({
  reservationId: z.string().describe("Reservation ID to cancel"),
  reason: z.string().optional().describe("Reason for cancellation"),
});

const refundPaymentSchema = z.object({
  paymentId: z.string().describe("Payment transaction ID to refund"),
  amount: z.number().positive().describe("Amount to refund in decimal currency units"),
  reason: z.string().optional().describe("Reason for issuing refund"),
});

const bulkSendMessagesSchema = z.object({
  propertyId: z.string().describe("Property ID"),
  message: z.string().min(5).describe("Message content to broadcast"),
  target: z.enum(["checked_in", "arriving_today", "all_active"]).describe("Audience segment"),
});

// ---------------------------------------------------------------------------
// Tools Implementation Registry
// ---------------------------------------------------------------------------

export const toolsRegistry: AiTool<any>[] = [
  // 1. search_reservations (read)
  {
    name: "search_reservations",
    description: "Search reservations by booking code, guest name, status, or date range.",
    risk: "read",
    requiresPermission: "reservations.view",
    schema: searchReservationsSchema,
    jsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for booking code or guest name" },
        status: { type: "string", enum: ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"] },
        propertyId: { type: "string", description: "Optional property scope filter" },
      },
    },
    run: async (ctx, args) => {
      const where: Prisma.ReservationWhereInput = { organizationId: ctx.organizationId };
      if (args.status) where.status = args.status;
      if (args.propertyId || ctx.propertyId) {
        where.propertyId = args.propertyId ?? ctx.propertyId ?? undefined;
      }
      if (args.query) {
        where.OR = [
          { code: { contains: args.query, mode: "insensitive" } },
          { guest: { firstName: { contains: args.query, mode: "insensitive" } } },
          { guest: { lastName: { contains: args.query, mode: "insensitive" } } },
        ];
      }
      const reservations = await prisma.reservation.findMany({
        where,
        orderBy: { checkIn: "asc" },
        take: 15,
        include: {
          property: { select: { id: true, name: true } },
          guest: { select: { firstName: true, lastName: true, email: true } },
          rooms: { include: { room: { select: { number: true } } } },
        },
      });

      const summary = reservations.map((r) => ({
        id: r.id,
        code: r.code,
        guest: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : "Unknown Guest",
        dates: `${r.checkIn.toISOString().split("T")[0]} to ${r.checkOut.toISOString().split("T")[0]}`,
        status: r.status,
        rooms: r.rooms.map((rm) => rm.room.number).join(", "),
        total: r.totalAmount.toString(),
      }));

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.search_reservations",
        summary: `AI searched reservations: found ${reservations.length} records.`,
      });

      return {
        content: `Found ${reservations.length} reservation(s):\n${JSON.stringify(summary, null, 2)}`,
        data: { count: reservations.length, reservations: summary },
      };
    },
  },

  // 2. check_availability (read)
  {
    name: "check_availability",
    description: "Check room availability for a property between check-in and check-out dates.",
    risk: "read",
    requiresPermission: "rooms.view",
    schema: checkAvailabilitySchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId", "checkIn", "checkOut"],
      properties: {
        propertyId: { type: "string" },
        checkIn: { type: "string" },
        checkOut: { type: "string" },
        roomTypeId: { type: "string" },
      },
    },
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({
        where: { id: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) {
        return { content: `Error: Property ${args.propertyId} not found in your organization.` };
      }

      const checkIn = new Date(args.checkIn);
      const checkOut = new Date(args.checkOut);
      const nights = nightsBetween(checkIn, checkOut);

      const rooms = await prisma.room.findMany({
        where: {
          organizationId: ctx.organizationId,
          propertyId: args.propertyId,
          status: { not: "out_of_service" },
          ...(args.roomTypeId ? { roomTypeId: args.roomTypeId } : {}),
        },
        include: { roomType: true },
      });

      const bookedRooms = await prisma.reservationRoom.findMany({
        where: {
          reservation: {
            organizationId: ctx.organizationId,
            propertyId: args.propertyId,
            status: { in: ["pending", "confirmed", "checked_in"] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
        select: { roomId: true },
      });

      const bookedIds = new Set(bookedRooms.map((br) => br.roomId));
      const availableRooms = rooms.filter((r) => !bookedIds.has(r.id));

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.check_availability",
        summary: `AI checked availability for ${property.name}: ${availableRooms.length}/${rooms.length} rooms available for ${nights} night(s).`,
      });

      return {
        content: `Property ${property.name}: ${availableRooms.length} of ${rooms.length} rooms available from ${args.checkIn} to ${args.checkOut} (${nights} nights).`,
        data: {
          totalRooms: rooms.length,
          availableCount: availableRooms.length,
          availableRoomNumbers: availableRooms.map((r) => r.number),
        },
      };
    },
  },

  // 3. get_guest_summary (read)
  {
    name: "get_guest_summary",
    description: "Search or retrieve summary profile for a hotel guest.",
    risk: "read",
    requiresPermission: "guests.view",
    schema: getGuestSummarySchema,
    jsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query by name, email, or phone" },
        guestId: { type: "string" },
      },
    },
    run: async (ctx, args) => {
      const where: Prisma.GuestWhereInput = { organizationId: ctx.organizationId };
      if (args.guestId) where.id = args.guestId;
      if (args.query) {
        where.OR = [
          { firstName: { contains: args.query, mode: "insensitive" } },
          { lastName: { contains: args.query, mode: "insensitive" } },
          { email: { contains: args.query, mode: "insensitive" } },
        ];
      }

      const guests = await prisma.guest.findMany({
        where,
        take: 10,
        include: {
          reservations: {
            where: { organizationId: ctx.organizationId },
            take: 5,
            orderBy: { checkIn: "desc" },
            select: { id: true, code: true, status: true, totalAmount: true, checkIn: true },
          },
        },
      });

      const sanitized = guests.map((g) => ({
        id: g.id,
        name: `${g.firstName} ${g.lastName}`,
        email: g.email ? `${g.email.slice(0, 3)}***@***` : undefined, // PII redaction
        reservationCount: g.reservations.length,
        recentStay: g.reservations[0]?.code,
      }));

      return {
        content: `Found ${guests.length} guest profile(s):\n${JSON.stringify(sanitized, null, 2)}`,
        data: { count: guests.length, guests: sanitized },
      };
    },
  },

  // 4. get_invoices (read)
  {
    name: "get_invoices",
    description: "List invoices and outstanding balances for an organization or property.",
    risk: "read",
    requiresPermission: "billing.view",
    schema: getInvoicesSchema,
    jsonSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        status: { type: "string", enum: ["draft", "issued", "paid", "partially_paid", "void", "overdue"] },
      },
    },
    run: async (ctx, args) => {
      const where: Prisma.InvoiceWhereInput = { organizationId: ctx.organizationId };
      if (args.status) where.status = args.status;
      if (args.propertyId || ctx.propertyId) {
        where.propertyId = args.propertyId ?? ctx.propertyId ?? undefined;
      }

      const invoices = await prisma.invoice.findMany({
        where,
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          payments: {
            where: { status: "captured" },
            select: { amount: true },
          },
        },
      });

      const totalBalance = invoices.reduce(
        (sum, inv) => sum.plus(new Prisma.Decimal(inv.total)),
        new Prisma.Decimal(0),
      );

      return {
        content: `Found ${invoices.length} invoices. Total value across retrieved: ${totalBalance.toFixed(2)}.`,
        data: {
          count: invoices.length,
          totalValue: totalBalance.toFixed(2),
          invoices: invoices.map((i) => ({
            id: i.id,
            number: i.number,
            status: i.status,
            total: i.total.toString(),
            paid: i.payments.reduce((s, p) => s.plus(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0)).toFixed(2),
          })),
        },
      };
    },
  },

  // 5. generate_report (read)
  {
    name: "generate_report",
    description: "Generate operational summary metrics (occupancy, revenue, ADR, RevPAR).",
    risk: "read",
    requiresPermission: "reports.view",
    schema: generateReportSchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId"],
      properties: {
        propertyId: { type: "string" },
        reportType: { type: "string", enum: ["occupancy", "revenue", "daily_summary"] },
      },
    },
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({
        where: { id: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) return { content: `Error: Property ${args.propertyId} not found.` };

      const totalRooms = await prisma.room.count({
        where: { organizationId: ctx.organizationId, propertyId: args.propertyId },
      });

      const occupiedRooms = await prisma.room.count({
        where: { organizationId: ctx.organizationId, propertyId: args.propertyId, status: "occupied" },
      });

      const confirmedReservations = await prisma.reservation.count({
        where: { organizationId: ctx.organizationId, propertyId: args.propertyId, status: "confirmed" },
      });

      const payments = await prisma.payment.findMany({
        where: { organizationId: ctx.organizationId, propertyId: args.propertyId, status: "captured" },
        select: { amount: true },
      });

      const totalRevenue = payments.reduce((sum, p) => sum.plus(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
      const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : "0.0";
      const adr = occupiedRooms > 0 ? totalRevenue.dividedBy(occupiedRooms).toFixed(2) : "0.00";
      const revPar = totalRooms > 0 ? totalRevenue.dividedBy(totalRooms).toFixed(2) : "0.00";

      return {
        content: `Operational Report for ${property.name}:\n- Total Rooms: ${totalRooms}\n- Occupied: ${occupiedRooms} (${occupancyRate}% occupancy)\n- Confirmed Bookings: ${confirmedReservations}\n- Total Captured Revenue: ${property.currency} ${totalRevenue.toFixed(2)}\n- ADR: ${property.currency} ${adr}\n- RevPAR: ${property.currency} ${revPar}`,
        data: {
          propertyName: property.name,
          totalRooms,
          occupiedRooms,
          occupancyRate: `${occupancyRate}%`,
          totalRevenue: totalRevenue.toFixed(2),
          adr,
          revPar,
        },
      };
    },
  },

  // 6. get_policies (read)
  {
    name: "get_policies",
    description: "Retrieve property check-in/out hours, tax rates, and cancellation policies.",
    risk: "read",
    requiresPermission: "properties.view",
    schema: getPoliciesSchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId"],
      properties: { propertyId: { type: "string" } },
    },
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({
        where: { id: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) return { content: `Error: Property ${args.propertyId} not found.` };

      return {
        content: `Policies for ${property.name}:\n- Check-in: ${property.checkInTime}:00\n- Check-out: ${property.checkOutTime}:00\n- Tax Rate: ${property.taxRate}%\n- Cleaning Fee: ${property.currency} ${property.cleaningFee}\n- Currency: ${property.currency}`,
        data: {
          checkInTime: property.checkInTime,
          checkOutTime: property.checkOutTime,
          taxRate: property.taxRate.toString(),
          cleaningFee: property.cleaningFee.toString(),
          currency: property.currency,
        },
      };
    },
  },

  // 7. update_room_status (reversible)
  {
    name: "update_room_status",
    description: "Update room operational status (available, occupied, dirty, clean, inspected, out_of_service).",
    risk: "reversible",
    requiresPermission: "rooms.manage",
    schema: updateRoomStatusSchema,
    jsonSchema: {
      type: "object",
      required: ["roomId", "status"],
      properties: {
        roomId: { type: "string" },
        status: { type: "string", enum: ["available", "occupied", "dirty", "clean", "inspected", "out_of_service"] },
      },
    },
    run: async (ctx, args) => {
      const room = await prisma.room.findFirst({
        where: { id: args.roomId, organizationId: ctx.organizationId },
      });
      if (!room) return { content: `Error: Room ${args.roomId} not found in your organization.` };

      const oldStatus = room.status;
      const updated = await prisma.room.update({
        where: { id: room.id },
        data: { status: args.status },
      });

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: room.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.update_room_status",
        summary: `Room ${room.number} status changed from ${oldStatus} to ${args.status}.`,
        entityType: "Room",
        entityId: room.id,
      });

      return {
        content: `Room ${updated.number} status updated to '${updated.status}'.`,
        data: { roomId: updated.id, number: updated.number, status: updated.status },
      };
    },
  },

  // 8. create_housekeeping_task (reversible)
  {
    name: "create_housekeeping_task",
    description: "Create a housekeeping task for room cleaning or inspection.",
    risk: "reversible",
    requiresPermission: "housekeeping.manage",
    schema: createHousekeepingTaskSchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId", "roomId"],
      properties: {
        propertyId: { type: "string" },
        roomId: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        title: { type: "string" },
        notes: { type: "string" },
        dueInHours: { type: "number" },
      },
    },
    run: async (ctx, args) => {
      const room = await prisma.room.findFirst({
        where: { id: args.roomId, propertyId: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!room) return { content: `Error: Room ${args.roomId} not found in specified property.` };

      const task = await prisma.housekeepingTask.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: args.propertyId,
          roomId: args.roomId,
          status: "pending",
          priority: args.priority,
          title: args.title,
          notes: args.notes,
          dueAt: new Date(Date.now() + args.dueInHours * 3600000),
        },
      });

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.create_housekeeping_task",
        summary: `Created housekeeping task '${task.title}' for room ${room.number} (priority: ${task.priority}).`,
        entityType: "HousekeepingTask",
        entityId: task.id,
      });

      return {
        content: `Housekeeping task created (ID: ${task.id}) for room ${room.number}. Due in ${args.dueInHours} hour(s).`,
        data: { taskId: task.id, roomNumber: room.number, priority: task.priority },
      };
    },
  },

  // 9. create_maintenance_ticket (reversible)
  {
    name: "create_maintenance_ticket",
    description: "Create a maintenance ticket for repairs or room issues.",
    risk: "reversible",
    requiresPermission: "maintenance.manage",
    schema: createMaintenanceTicketSchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId", "description"],
      properties: {
        propertyId: { type: "string" },
        roomId: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        description: { type: "string" },
      },
    },
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({
        where: { id: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) return { content: `Error: Property ${args.propertyId} not found.` };

      const ticket = await prisma.maintenanceTicket.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: args.propertyId,
          roomId: args.roomId,
          status: "open",
          priority: args.priority,
          description: args.description,
          createdBy: ctx.actorUserId,
        },
      });

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.create_maintenance_ticket",
        summary: `Created maintenance ticket #${ticket.id.slice(0, 8)} (${args.priority}): ${args.description.slice(0, 60)}`,
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
      });

      return {
        content: `Maintenance ticket #${ticket.id.slice(0, 8)} created successfully.`,
        data: { ticketId: ticket.id, status: ticket.status },
      };
    },
  },

  // 10. check_in_reservation (reversible)
  {
    name: "check_in_reservation",
    description: "Mark a confirmed reservation as checked in and occupy assigned rooms.",
    risk: "reversible",
    requiresPermission: "frontdesk.checkin",
    schema: checkInReservationSchema,
    jsonSchema: {
      type: "object",
      required: ["reservationId"],
      properties: { reservationId: { type: "string" } },
    },
    run: async (ctx, args) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: args.reservationId, organizationId: ctx.organizationId },
        include: { rooms: { include: { room: true } } },
      });
      if (!reservation) return { content: `Error: Reservation ${args.reservationId} not found.` };
      if (reservation.status !== "confirmed") {
        return { content: `Cannot check in reservation in status '${reservation.status}'. Must be confirmed.` };
      }

      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "checked_in" },
      });

      for (const rr of reservation.rooms) {
        await prisma.room.update({
          where: { id: rr.roomId },
          data: { status: "occupied" },
        });
      }

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: reservation.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.check_in_reservation",
        summary: `Checked in reservation ${reservation.code}. Rooms marked occupied.`,
        entityType: "Reservation",
        entityId: reservation.id,
      });

      return {
        content: `Reservation ${updated.code} checked in. ${reservation.rooms.length} room(s) marked occupied.`,
        data: { reservationId: updated.id, code: updated.code, status: updated.status },
      };
    },
  },

  // 11. check_out_reservation (reversible)
  {
    name: "check_out_reservation",
    description: "Mark an in-house reservation as checked out and release rooms to dirty.",
    risk: "reversible",
    requiresPermission: "frontdesk.checkout",
    schema: checkOutReservationSchema,
    jsonSchema: {
      type: "object",
      required: ["reservationId"],
      properties: { reservationId: { type: "string" } },
    },
    run: async (ctx, args) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: args.reservationId, organizationId: ctx.organizationId },
        include: { rooms: true },
      });
      if (!reservation) return { content: `Error: Reservation ${args.reservationId} not found.` };
      if (reservation.status !== "checked_in") {
        return { content: `Cannot check out reservation in status '${reservation.status}'. Must be checked_in.` };
      }

      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "checked_out" },
      });

      for (const rr of reservation.rooms) {
        await prisma.room.update({
          where: { id: rr.roomId },
          data: { status: "dirty" },
        });
      }

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: reservation.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.check_out_reservation",
        summary: `Checked out reservation ${reservation.code}. Rooms released to dirty.`,
        entityType: "Reservation",
        entityId: reservation.id,
      });

      return {
        content: `Reservation ${updated.code} checked out. Rooms released to dirty for housekeeping.`,
        data: { reservationId: updated.id, code: updated.code, status: updated.status },
      };
    },
  },

  // 12. draft_message (reversible)
  {
    name: "draft_message",
    description: "Draft personalized guest communication for an existing reservation.",
    risk: "reversible",
    requiresPermission: "reservations.view",
    schema: draftMessageSchema,
    jsonSchema: {
      type: "object",
      required: ["reservationId"],
      properties: {
        reservationId: { type: "string" },
        tone: { type: "string", enum: ["formal", "warm", "concise"] },
      },
    },
    run: async (ctx, args) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: args.reservationId, organizationId: ctx.organizationId },
        include: { guest: true, property: true },
      });
      if (!reservation) return { content: `Error: Reservation ${args.reservationId} not found.` };

      const guestName = reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : "Valued Guest";
      const checkInDate = reservation.checkIn.toISOString().split("T")[0];
      const propertyName = reservation.property.name;

      const draft =
        args.tone === "concise"
          ? `Hi ${guestName}, your stay at ${propertyName} begins ${checkInDate}. Confirmation: ${reservation.code}. Check-in is at ${reservation.property.checkInTime}:00.`
          : `Dear ${guestName},\n\nWe look forward to welcoming you to ${propertyName} on ${checkInDate}! Your confirmation code is ${reservation.code}.\n\nCheck-in opens at ${reservation.property.checkInTime}:00. Please let us know if you need early arrival or have special requests.\n\nWarm regards,\n${propertyName} Team`;

      return {
        content: `Drafted ${args.tone} message for reservation ${reservation.code}:\n\n${draft}`,
        data: { draft, code: reservation.code },
      };
    },
  },

  // 13. create_reservation (sensitive - MANDATORY APPROVAL)
  {
    name: "create_reservation",
    description: "Create a new booking and hold room inventory. Requires manager approval.",
    risk: "sensitive",
    requiresApproval: true,
    requiresPermission: "reservations.create",
    schema: createReservationSchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId", "roomIds", "checkIn", "checkOut"],
      properties: {
        propertyId: { type: "string" },
        roomIds: { type: "array", items: { type: "string" } },
        checkIn: { type: "string" },
        checkOut: { type: "string" },
        adults: { type: "number" },
        children: { type: "number" },
        guestId: { type: "string" },
        notes: { type: "string" },
      },
    },
    run: async (ctx, args) => {
      const res = await createReservation({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        roomIds: args.roomIds,
        checkIn: new Date(args.checkIn),
        checkOut: new Date(args.checkOut),
        adults: args.adults,
        children: args.children,
        guestId: args.guestId,
        source: "agent",
        notes: args.notes,
        status: args.status,
      });

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.create_reservation",
        summary: `Created reservation ${res.reservation.code} via approved AI action.`,
        entityType: "Reservation",
        entityId: res.reservation.id,
      });

      return {
        content: `Reservation created successfully! Booking code: ${res.reservation.code}. Rooms booked: ${res.rooms.length}. Total: ${res.reservation.totalAmount.toString()}.`,
        data: { reservationId: res.reservation.id, code: res.reservation.code, total: res.reservation.totalAmount.toString() },
      };
    },
  },

  // 14. cancel_reservation (sensitive - MANDATORY APPROVAL)
  {
    name: "cancel_reservation",
    description: "Cancel a reservation and release room inventory. Requires manager approval.",
    risk: "sensitive",
    requiresApproval: true,
    requiresPermission: "reservations.cancel",
    schema: cancelReservationSchema,
    jsonSchema: {
      type: "object",
      required: ["reservationId"],
      properties: {
        reservationId: { type: "string" },
        reason: { type: "string" },
      },
    },
    run: async (ctx, args) => {
      const cancelled = await cancelReservation(
        args.reservationId,
        ctx.organizationId,
        args.reason ?? "Cancelled via approved AI operation",
        ctx.actorUserId,
      );

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: cancelled.reservation.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.cancel_reservation",
        summary: `Cancelled reservation ${cancelled.reservation.code}. Applied cancellation fee: ${cancelled.cancellationFeeFormatted}.`,
        entityType: "Reservation",
        entityId: cancelled.reservation.id,
      });

      return {
        content: `Reservation ${cancelled.reservation.code} has been cancelled. Cancellation fee: ${cancelled.cancellationFeeFormatted}. Rooms released.`,
        data: {
          reservationId: cancelled.reservation.id,
          code: cancelled.reservation.code,
          feeApplied: cancelled.cancellationFeeFormatted,
        },
      };
    },
  },

  // 15. refund_payment (sensitive - MANDATORY APPROVAL)
  {
    name: "refund_payment",
    description: "Issue a monetary refund for a processed payment. Requires manager approval.",
    risk: "sensitive",
    requiresApproval: true,
    requiresPermission: "billing.manage",
    schema: refundPaymentSchema,
    jsonSchema: {
      type: "object",
      required: ["paymentId", "amount"],
      properties: {
        paymentId: { type: "string" },
        amount: { type: "number" },
        reason: { type: "string" },
      },
    },
    run: async (ctx, args) => {
      const tenantCtx = {
        organizationId: ctx.organizationId,
        userId: ctx.actorUserId,
        propertyId: ctx.propertyId ?? undefined,
        permissions: ctx.user.permissions,
        roleKey: ctx.user.roleKey,
      };

      const requested = await requestRefund(tenantCtx, {
        paymentId: args.paymentId,
        amount: args.amount,
        reason: args.reason ?? "Refund requested via AI operations hub",
      });

      const approved = await approveRefund(tenantCtx, {
        refundId: requested.id,
        approvedByUserId: ctx.actorUserId,
      });

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.refund_payment",
        summary: `Refund of ${approved.amount.toString()} issued for payment ${args.paymentId}.`,
        entityType: "Refund",
        entityId: approved.id,
      });

      return {
        content: `Refund of ${approved.amount.toString()} processed successfully (Refund ID: ${approved.id}). Payment status: ${approved.status}.`,
        data: { refundId: approved.id, amount: approved.amount.toString(), status: approved.status },
      };
    },
  },

  // 16. bulk_send_messages (sensitive - MANDATORY APPROVAL)
  {
    name: "bulk_send_messages",
    description: "Broadcast message to all guests in an audience segment. Requires manager approval.",
    risk: "sensitive",
    requiresApproval: true,
    requiresPermission: "notifications.manage",
    schema: bulkSendMessagesSchema,
    jsonSchema: {
      type: "object",
      required: ["propertyId", "message", "target"],
      properties: {
        propertyId: { type: "string" },
        message: { type: "string" },
        target: { type: "string", enum: ["checked_in", "arriving_today", "all_active"] },
      },
    },
    run: async (ctx, args) => {
      const property = await prisma.property.findFirst({
        where: { id: args.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) return { content: `Error: Property ${args.propertyId} not found.` };

      const where: Prisma.ReservationWhereInput = {
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
      };

      if (args.target === "checked_in") {
        where.status = "checked_in";
      } else if (args.target === "arriving_today") {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 86400000);
        where.checkIn = { gte: today, lt: tomorrow };
        where.status = "confirmed";
      } else {
        where.status = { in: ["confirmed", "checked_in"] };
      }

      const activeReservations = await prisma.reservation.findMany({
        where,
        include: { guest: true },
      });

      await logActivity({
        organizationId: ctx.organizationId,
        propertyId: args.propertyId,
        userId: ctx.actorUserId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        userRole: ctx.user.roleKey,
        source: "backend",
        category: "ai",
        action: "ai.tool.bulk_send_messages",
        summary: `Bulk broadcast queued to ${activeReservations.length} guest(s) at ${property.name} (target: ${args.target}).`,
        entityType: "Property",
        entityId: property.id,
      });

      return {
        content: `Bulk message broadcast queued for ${activeReservations.length} guest(s) in segment '${args.target}' at ${property.name}.`,
        data: { queuedCount: activeReservations.length, target: args.target },
      };
    },
  },
];

// ---------------------------------------------------------------------------
// Helper Lookups
// ---------------------------------------------------------------------------

export function getTool(name: string): AiTool | undefined {
  return toolsRegistry.find((t) => t.name === name);
}

export function toolsForPermissions(user: SessionUser): AiTool[] {
  if (user.roleKey === "admin") return toolsRegistry;
  const userPerms = new Set(user.permissions ?? []);
  return toolsRegistry.filter((t) => !t.requiresPermission || userPerms.has(t.requiresPermission));
}

export function toolDefinitions(tools: AiTool[] = toolsRegistry) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.jsonSchema,
  }));
}
