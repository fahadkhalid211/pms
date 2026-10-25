import prisma from "@/lib/db";
import type { Prisma, RoomStatus, HousekeepingStatus, TaskPriority, MaintenanceStatus, MaintenancePriority, InvoiceStatus, PaymentStatus } from "@prisma/client";

export interface TenantContext {
  organizationId: string;
  propertyId?: string | null;
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Resource not found.") {
    super(message);
    this.status = 404;
  }
}

export class CrossTenantViolationError extends Error {
  status = 403;
  constructor(message = "Cross-tenant access violation: referenced entity does not belong to your organization.") {
    super(message);
    this.status = 403;
  }
}

export const dal = {
  properties: {
    async findMany(ctx: TenantContext) {
      return prisma.property.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(ctx.propertyId ? { id: ctx.propertyId } : {}),
        },
        orderBy: { name: "asc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const property = await prisma.property.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!property) throw new NotFoundError("Property not found.");
      return property;
    },

    async create(ctx: TenantContext, data: Omit<Prisma.PropertyUncheckedCreateInput, "organizationId">) {
      return prisma.property.create({
        data: {
          ...data,
          organizationId: ctx.organizationId,
        },
      });
    },

    async update(ctx: TenantContext, id: string, data: Prisma.PropertyUpdateInput) {
      await dal.properties.findUnique(ctx, id);
      return prisma.property.update({
        where: { id },
        data,
      });
    },
  },

  rooms: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.room.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        include: { roomType: true },
        orderBy: { number: "asc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const room = await prisma.room.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: { roomType: true, property: true },
      });
      if (!room) throw new NotFoundError("Room not found.");
      return room;
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId: string;
        roomTypeId: string;
        number: string;
        name?: string | null;
        floor?: string | null;
        status?: RoomStatus;
      },
    ) {
      // Verify foreign property belongs to tenant
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");

      // Verify foreign roomType belongs to tenant
      const roomType = await prisma.roomType.findFirst({
        where: { id: data.roomTypeId, organizationId: ctx.organizationId },
      });
      if (!roomType) throw new CrossTenantViolationError("Room type does not belong to your organization.");

      return prisma.room.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          roomTypeId: data.roomTypeId,
          number: data.number,
          name: data.name,
          floor: data.floor,
          status: data.status ?? "available",
        },
      });
    },

    async update(ctx: TenantContext, id: string, data: Prisma.RoomUpdateInput) {
      await dal.rooms.findUnique(ctx, id);
      return prisma.room.update({
        where: { id },
        data,
      });
    },
  },

  reservations: {
    async findMany(ctx: TenantContext, filters?: { propertyId?: string; status?: string; search?: string }) {
      return prisma.reservation.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(filters?.propertyId ? { propertyId: filters.propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
          ...(filters?.status ? { status: filters.status as any } : {}),
          ...(filters?.search
            ? {
                OR: [
                  { code: { contains: filters.search, mode: "insensitive" } },
                  { guest: { firstName: { contains: filters.search, mode: "insensitive" } } },
                  { guest: { lastName: { contains: filters.search, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        include: {
          guest: true,
          rooms: { include: { room: { include: { roomType: true } } } },
          invoices: true,
        },
        orderBy: { checkIn: "asc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const res = await prisma.reservation.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: {
          guest: true,
          rooms: { include: { room: true } },
          invoices: { include: { lineItems: true, payments: true } },
        },
      });
      if (!res) throw new NotFoundError("Reservation not found.");
      return res;
    },

    async update(ctx: TenantContext, id: string, data: Prisma.ReservationUpdateInput) {
      await dal.reservations.findUnique(ctx, id);
      return prisma.reservation.update({
        where: { id },
        data,
      });
    },
  },

  invoices: {
    async findMany(ctx: TenantContext, filters?: { propertyId?: string; status?: InvoiceStatus }) {
      return prisma.invoice.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(filters?.propertyId ? { propertyId: filters.propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
          ...(filters?.status ? { status: filters.status } : {}),
        },
        include: { lineItems: true, payments: true },
        orderBy: { createdAt: "desc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const invoice = await prisma.invoice.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: { lineItems: true, payments: true },
      });
      if (!invoice) throw new NotFoundError("Invoice not found.");
      return invoice;
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId: string;
        reservationId?: string | null;
        number?: string;
        status?: InvoiceStatus;
        subtotal?: number;
        tax?: number;
        total?: number;
        currency?: string;
        dueDate?: Date | null;
        lineItems?: { description: string; quantity: number; unitAmount: number; total: number }[];
      },
    ) {
      // Verify foreign property belongs to tenant
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");

      if (data.reservationId) {
        const res = await prisma.reservation.findFirst({
          where: { id: data.reservationId, organizationId: ctx.organizationId },
        });
        if (!res) throw new CrossTenantViolationError("Reservation does not belong to your organization.");
      }

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          reservationId: data.reservationId ?? null,
          number: data.number ?? `INV-${Date.now().toString(36).toUpperCase()}`,
          status: data.status ?? "issued",
          subtotal: data.subtotal ?? 0,
          tax: data.tax ?? 0,
          total: data.total ?? 0,
          currency: data.currency ?? "USD",
          dueDate: data.dueDate ?? null,
        },
      });

      if (data.lineItems?.length) {
        for (const item of data.lineItems) {
          await prisma.invoiceLineItem.create({
            data: {
              organizationId: ctx.organizationId,
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unitAmount,
              total: item.total,
            },
          });
        }
      }

      return dal.invoices.findUnique(ctx, invoice.id);
    },

    async update(ctx: TenantContext, id: string, data: { status?: InvoiceStatus }) {
      await dal.invoices.findUnique(ctx, id);
      return prisma.invoice.update({
        where: { id },
        data: {
          status: data.status,
        },
      });
    },
  },

  payments: {
    async findMany(ctx: TenantContext, filters?: { propertyId?: string }) {
      return prisma.payment.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(filters?.propertyId ? { propertyId: filters.propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        include: { invoice: { select: { number: true, total: true } } },
        orderBy: { createdAt: "desc" },
      });
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId?: string;
        invoiceId?: string;
        reservationId?: string;
        amount: number;
        currency?: string;
        status?: PaymentStatus;
        method?: string;
        provider?: string;
        providerRef?: string;
      },
    ) {
      if (data.invoiceId) {
        const invoice = await prisma.invoice.findFirst({
          where: { id: data.invoiceId, organizationId: ctx.organizationId },
        });
        if (!invoice) throw new CrossTenantViolationError("Invoice does not belong to your organization.");
      }

      if (data.propertyId) {
        const property = await prisma.property.findFirst({
          where: { id: data.propertyId, organizationId: ctx.organizationId },
        });
        if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");
      }

      const payment = await prisma.payment.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          invoiceId: data.invoiceId,
          reservationId: data.reservationId,
          amount: data.amount,
          currency: data.currency ?? "USD",
          status: data.status ?? "captured",
          method: data.method ?? "card",
          provider: data.provider,
          providerRef: data.providerRef,
          capturedAt: data.status === "captured" ? new Date() : undefined,
        },
      });

      if (data.status === "captured" && data.invoiceId) {
        await prisma.invoice.update({
          where: { id: data.invoiceId },
          data: { status: "paid" },
        });
      }

      return payment;
    },
  },

  housekeeping: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.housekeepingTask.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        include: { room: { include: { roomType: true } } },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      });
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId: string;
        roomId: string;
        status?: HousekeepingStatus;
        priority?: TaskPriority;
        title?: string | null;
        notes?: string | null;
        assigneeId?: string | null;
        dueAt?: Date | null;
      },
    ) {
      const room = await prisma.room.findFirst({
        where: { id: data.roomId, organizationId: ctx.organizationId, propertyId: data.propertyId },
      });
      if (!room) throw new CrossTenantViolationError("Room does not belong to your organization or property.");

      return prisma.housekeepingTask.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          roomId: data.roomId,
          status: data.status ?? "pending",
          priority: data.priority ?? "normal",
          title: data.title,
          notes: data.notes,
          assigneeId: data.assigneeId,
          dueAt: data.dueAt ?? null,
        },
      });
    },
  },

  maintenance: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.maintenanceTicket.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        include: { room: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const ticket = await prisma.maintenanceTicket.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: { room: true },
      });
      if (!ticket) throw new NotFoundError("Maintenance ticket not found.");
      return ticket;
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId: string;
        roomId?: string;
        status?: MaintenanceStatus;
        priority?: MaintenancePriority;
        description: string;
        assigneeId?: string;
      },
    ) {
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");

      if (data.roomId) {
        const room = await prisma.room.findFirst({
          where: { id: data.roomId, organizationId: ctx.organizationId, propertyId: data.propertyId },
        });
        if (!room) throw new CrossTenantViolationError("Room does not belong to your organization or property.");
      }

      return prisma.maintenanceTicket.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          roomId: data.roomId,
          status: data.status ?? "open",
          priority: data.priority ?? "normal",
          description: data.description,
          assigneeId: data.assigneeId,
        },
      });
    },

    async update(
      ctx: TenantContext,
      id: string,
      data: {
        status?: MaintenanceStatus;
        priority?: MaintenancePriority;
        assigneeId?: string;
      },
    ) {
      await dal.maintenance.findUnique(ctx, id);
      return prisma.maintenanceTicket.update({
        where: { id },
        data: {
          status: data.status,
          priority: data.priority,
          assigneeId: data.assigneeId,
          resolvedAt: data.status === "resolved" ? new Date() : undefined,
        },
      });
    },
  },

  reports: {
    async getOperationalSummary(ctx: TenantContext, targetPropertyId?: string) {
      const propId = targetPropertyId ?? ctx.propertyId ?? undefined;

      const properties = await prisma.property.findMany({
        where: { organizationId: ctx.organizationId, ...(propId ? { id: propId } : {}) },
      });
      const propertyIds = properties.map((p) => p.id);

      const reservations = await prisma.reservation.findMany({
        where: {
          organizationId: ctx.organizationId,
          propertyId: { in: propertyIds },
          status: "confirmed",
        },
        include: { rooms: { include: { room: true } } },
      });

      const revenue = await prisma.payment.aggregate({
        where: {
          organizationId: ctx.organizationId,
          propertyId: { in: propertyIds },
          status: "captured",
        },
        _sum: { amount: true },
      });

      const outstanding = await prisma.invoice.aggregate({
        where: {
          organizationId: ctx.organizationId,
          propertyId: { in: propertyIds },
          status: { in: ["issued", "overdue"] },
        },
        _sum: { total: true },
      });

      const rooms = await prisma.room.findMany({
        where: { organizationId: ctx.organizationId, propertyId: { in: propertyIds } },
        select: { id: true, status: true },
      });

      const occupied = rooms.filter((r) => r.status === "occupied").length;
      const occupancy = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

      const nights = reservations.reduce((acc, r) => {
        const ms = new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime();
        return acc + Math.max(0, Math.round(ms / 86400000));
      }, 0);
      const adr = nights > 0 ? Number(revenue._sum.amount ?? 0) / nights : 0;

      return {
        properties,
        reservations,
        revenueCaptured: Number(revenue._sum.amount ?? 0),
        outstandingTotal: Number(outstanding._sum.total ?? 0),
        roomsCount: rooms.length,
        occupiedRooms: occupied,
        occupancyPercentage: occupancy,
        adr,
      };
    },
  },
};
