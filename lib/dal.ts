import prisma from "@/lib/db";
import { Prisma, type RoomStatus, type HousekeepingStatus, type TaskPriority, type MaintenanceStatus, type MaintenancePriority, type InvoiceStatus, type PaymentStatus } from "@prisma/client";
import { createReservation, updateReservation, cancelReservation, checkRoomsAvailability, type CreateReservationInput } from "@/lib/reservations";

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
        include: {
          roomTypes: true,
          ratePlans: { include: { seasons: true } },
        },
      });
      if (!property) throw new NotFoundError("Property not found.");
      return property;
    },

    async create(
      ctx: TenantContext,
      data: {
        name: string;
        code?: string;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        state?: string | null;
        postalCode?: string | null;
        country?: string | null;
        phone?: string | null;
        email?: string | null;
        timezone?: string;
        currency?: string;
        checkInTime?: number;
        checkOutTime?: number;
        taxRate?: Prisma.Decimal | string | number;
        cleaningFee?: Prisma.Decimal | string | number;
        description?: string | null;
      },
    ) {
      return prisma.property.create({
        data: {
          organizationId: ctx.organizationId,
          name: data.name,
          code: data.code ?? "PROP",
          addressLine1: data.addressLine1 ?? null,
          addressLine2: data.addressLine2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          postalCode: data.postalCode ?? null,
          country: data.country ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          timezone: data.timezone ?? "UTC",
          currency: data.currency ?? "USD",
          checkInTime: data.checkInTime ?? 15,
          checkOutTime: data.checkOutTime ?? 11,
          taxRate: new Prisma.Decimal(data.taxRate ?? 0),
          cleaningFee: new Prisma.Decimal(data.cleaningFee ?? 0),
          description: data.description ?? null,
          status: "active",
        },
      });
    },

    async update(
      ctx: TenantContext,
      id: string,
      data: {
        name?: string;
        code?: string;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        state?: string | null;
        postalCode?: string | null;
        country?: string | null;
        phone?: string | null;
        email?: string | null;
        timezone?: string;
        currency?: string;
        checkInTime?: number;
        checkOutTime?: number;
        taxRate?: Prisma.Decimal | string | number;
        cleaningFee?: Prisma.Decimal | string | number;
        description?: string | null;
        status?: any;
      },
    ) {
      await dal.properties.findUnique(ctx, id);
      return prisma.property.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(data.addressLine1 !== undefined ? { addressLine1: data.addressLine1 } : {}),
          ...(data.addressLine2 !== undefined ? { addressLine2: data.addressLine2 } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.state !== undefined ? { state: data.state } : {}),
          ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
          ...(data.country !== undefined ? { country: data.country } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.checkInTime !== undefined ? { checkInTime: data.checkInTime } : {}),
          ...(data.checkOutTime !== undefined ? { checkOutTime: data.checkOutTime } : {}),
          ...(data.taxRate !== undefined ? { taxRate: new Prisma.Decimal(data.taxRate) } : {}),
          ...(data.cleaningFee !== undefined ? { cleaningFee: new Prisma.Decimal(data.cleaningFee) } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
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
    async findMany(ctx: TenantContext, filters?: { propertyId?: string; status?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
      const page = Math.max(1, filters?.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 20));
      const propId = filters?.propertyId ?? ctx.propertyId ?? undefined;

      const where: Prisma.ReservationWhereInput = {
        organizationId: ctx.organizationId,
        ...(propId ? { propertyId: propId } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      };

      if (filters?.from || filters?.to) {
        where.checkIn = {};
        if (filters?.from) where.checkIn.gte = new Date(filters.from);
        if (filters?.to) where.checkIn.lte = new Date(filters.to);
      }

      if (filters?.search) {
        const q = filters.search.trim();
        where.OR = [
          { code: { contains: q, mode: "insensitive" } },
          { guest: { firstName: { contains: q, mode: "insensitive" } } },
          { guest: { lastName: { contains: q, mode: "insensitive" } } },
          { guest: { email: { contains: q, mode: "insensitive" } } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.reservation.findMany({
          where,
          include: {
            guest: true,
            rooms: { include: { room: { include: { roomType: true } } } },
            invoices: true,
            property: { select: { id: true, name: true, code: true, currency: true } },
          },
          orderBy: { checkIn: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.reservation.count({ where }),
      ]);

      return { items, total, page, pageSize };
    },

    async findUnique(ctx: TenantContext, id: string) {
      const res = await prisma.reservation.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: {
          guest: true,
          rooms: { include: { room: { include: { roomType: true } } } },
          roomNights: { orderBy: { date: "asc" } },
          invoices: { include: { lineItems: true, payments: true } },
          property: true,
        },
      });
      if (!res) throw new NotFoundError("Reservation not found.");
      return res;
    },

    async create(
      ctx: TenantContext,
      data: Omit<CreateReservationInput, "organizationId">,
    ) {
      return createReservation({
        ...data,
        organizationId: ctx.organizationId,
      });
    },

    async update(
      ctx: TenantContext,
      id: string,
      data: {
        status?: any;
        checkIn?: Date | string;
        checkOut?: Date | string;
        roomIds?: string[];
        adults?: number;
        children?: number;
        notes?: string | null;
        cancelledReason?: string | null;
      },
      userId?: string,
    ) {
      return updateReservation(id, ctx.organizationId, data, userId);
    },

    async cancel(ctx: TenantContext, id: string, reason?: string, userId?: string) {
      return cancelReservation(id, ctx.organizationId, reason, userId);
    },

    async checkAvailability(
      ctx: TenantContext,
      propertyId: string,
      roomIds: string[],
      checkIn: Date | string,
      checkOut: Date | string,
    ) {
      return checkRoomsAvailability(propertyId, ctx.organizationId, roomIds, checkIn, checkOut);
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

  roomTypes: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.roomType.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        include: {
          property: { select: { id: true, name: true, currency: true } },
          _count: { select: { rooms: true } },
        },
        orderBy: { name: "asc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const roomType = await prisma.roomType.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: {
          property: true,
          rooms: true,
        },
      });
      if (!roomType) throw new NotFoundError("Room type not found.");
      return roomType;
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId: string;
        name: string;
        capacity?: number;
        sizeSqm?: number | null;
        bedType?: string | null;
        baseRate: Prisma.Decimal | string | number;
        depositType?: string | null;
        depositAmount?: Prisma.Decimal | string | number;
        cancellationPolicy?: any;
        status?: string;
      },
    ) {
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");

      return prisma.roomType.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          name: data.name,
          capacity: data.capacity ?? 2,
          sizeSqm: data.sizeSqm ?? null,
          bedType: data.bedType ?? "King",
          baseRate: new Prisma.Decimal(data.baseRate),
          depositType: data.depositType ?? "none",
          depositAmount: new Prisma.Decimal(data.depositAmount ?? 0),
          cancellationPolicy: data.cancellationPolicy ?? null,
          status: data.status ?? "active",
        },
        include: {
          property: { select: { id: true, name: true, currency: true } },
        },
      });
    },

    async update(
      ctx: TenantContext,
      id: string,
      data: {
        name?: string;
        capacity?: number;
        sizeSqm?: number | null;
        bedType?: string | null;
        baseRate?: Prisma.Decimal | string | number;
        depositType?: string | null;
        depositAmount?: Prisma.Decimal | string | number;
        cancellationPolicy?: any;
        status?: string;
      },
    ) {
      await dal.roomTypes.findUnique(ctx, id);
      return prisma.roomType.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
          ...(data.sizeSqm !== undefined ? { sizeSqm: data.sizeSqm } : {}),
          ...(data.bedType !== undefined ? { bedType: data.bedType } : {}),
          ...(data.baseRate !== undefined ? { baseRate: new Prisma.Decimal(data.baseRate) } : {}),
          ...(data.depositType !== undefined ? { depositType: data.depositType } : {}),
          ...(data.depositAmount !== undefined ? { depositAmount: new Prisma.Decimal(data.depositAmount) } : {}),
          ...(data.cancellationPolicy !== undefined ? { cancellationPolicy: data.cancellationPolicy } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      });
    },

    async delete(ctx: TenantContext, id: string) {
      await dal.roomTypes.findUnique(ctx, id);
      const roomsCount = await prisma.room.count({
        where: { roomTypeId: id, organizationId: ctx.organizationId },
      });
      if (roomsCount > 0) {
        throw new Error("Cannot delete room type: rooms are currently assigned to this room type.");
      }
      return prisma.roomType.delete({
        where: { id },
      });
    },
  },

  ratePlans: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.ratePlan.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        include: {
          property: { select: { id: true, name: true, currency: true } },
          seasons: { orderBy: { startDate: "asc" } },
        },
        orderBy: { name: "asc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const plan = await prisma.ratePlan.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: {
          property: true,
          seasons: { orderBy: { startDate: "asc" } },
        },
      });
      if (!plan) throw new NotFoundError("Rate plan not found.");
      return plan;
    },

    async create(
      ctx: TenantContext,
      data: {
        propertyId: string;
        name: string;
        type?: "fixed" | "percentage_modifier" | "seasonal";
        amount: Prisma.Decimal | string | number;
        currency?: string;
        isActive?: boolean;
        seasons?: Array<{
          startDate: Date | string;
          endDate: Date | string;
          amount: Prisma.Decimal | string | number;
        }>;
      },
    ) {
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, organizationId: ctx.organizationId },
      });
      if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");

      return prisma.ratePlan.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: data.propertyId,
          name: data.name,
          type: data.type ?? "fixed",
          amount: new Prisma.Decimal(data.amount),
          currency: data.currency ?? property.currency ?? "USD",
          isActive: data.isActive ?? true,
          seasons: data.seasons?.length
            ? {
                create: data.seasons.map((s) => ({
                  organizationId: ctx.organizationId,
                  startDate: new Date(s.startDate),
                  endDate: new Date(s.endDate),
                  amount: new Prisma.Decimal(s.amount),
                })),
              }
            : undefined,
        },
        include: { seasons: true },
      });
    },

    async update(
      ctx: TenantContext,
      id: string,
      data: {
        name?: string;
        type?: "fixed" | "percentage_modifier" | "seasonal";
        amount?: Prisma.Decimal | string | number;
        currency?: string;
        isActive?: boolean;
      },
    ) {
      await dal.ratePlans.findUnique(ctx, id);
      return prisma.ratePlan.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        include: { seasons: true },
      });
    },

    async delete(ctx: TenantContext, id: string) {
      await dal.ratePlans.findUnique(ctx, id);
      return prisma.ratePlan.delete({
        where: { id },
      });
    },
  },

  seasonalRates: {
    async create(
      ctx: TenantContext,
      data: {
        ratePlanId: string;
        startDate: Date | string;
        endDate: Date | string;
        amount: Prisma.Decimal | string | number;
      },
    ) {
      const ratePlan = await prisma.ratePlan.findFirst({
        where: { id: data.ratePlanId, organizationId: ctx.organizationId },
      });
      if (!ratePlan) throw new CrossTenantViolationError("Rate plan does not belong to your organization.");

      return prisma.seasonalRate.create({
        data: {
          organizationId: ctx.organizationId,
          ratePlanId: data.ratePlanId,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          amount: new Prisma.Decimal(data.amount),
        },
      });
    },

    async delete(ctx: TenantContext, id: string) {
      const season = await prisma.seasonalRate.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!season) throw new NotFoundError("Seasonal rate not found.");
      return prisma.seasonalRate.delete({
        where: { id },
      });
    },
  },

  discounts: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.discount.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async findUnique(ctx: TenantContext, id: string) {
      const discount = await prisma.discount.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!discount) throw new NotFoundError("Discount not found.");
      return discount;
    },

    async findByCode(ctx: TenantContext, code: string, propertyId?: string) {
      const now = new Date();
      return prisma.discount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          code: { equals: code.trim(), mode: "insensitive" },
          ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
        },
      });
    },

    async create(
      ctx: TenantContext,
      data: {
        code: string;
        type?: "percent" | "fixed";
        value: Prisma.Decimal | string | number;
        propertyId?: string | null;
        maxRedemptions?: number;
        validFrom?: Date | string | null;
        validTo?: Date | string | null;
      },
    ) {
      if (data.propertyId) {
        const prop = await prisma.property.findFirst({
          where: { id: data.propertyId, organizationId: ctx.organizationId },
        });
        if (!prop) throw new CrossTenantViolationError("Property does not belong to your organization.");
      }

      return prisma.discount.create({
        data: {
          organizationId: ctx.organizationId,
          code: data.code.toUpperCase().trim(),
          type: data.type ?? "percent",
          value: new Prisma.Decimal(data.value),
          propertyId: data.propertyId ?? null,
          maxRedemptions: data.maxRedemptions ?? 0,
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
          validTo: data.validTo ? new Date(data.validTo) : null,
        },
      });
    },

    async delete(ctx: TenantContext, id: string) {
      await dal.discounts.findUnique(ctx, id);
      return prisma.discount.delete({
        where: { id },
      });
    },
  },

  amenities: {
    async findMany(ctx: TenantContext, propertyId?: string) {
      return prisma.amenity.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(propertyId ? { propertyId } : ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
        },
        orderBy: { name: "asc" },
      });
    },

    async create(
      ctx: TenantContext,
      data: {
        name: string;
        category?: string | null;
        propertyId?: string | null;
      },
    ) {
      if (data.propertyId) {
        const prop = await prisma.property.findFirst({
          where: { id: data.propertyId, organizationId: ctx.organizationId },
        });
        if (!prop) throw new CrossTenantViolationError("Property does not belong to your organization.");
      }

      return prisma.amenity.create({
        data: {
          organizationId: ctx.organizationId,
          name: data.name,
          category: data.category ?? null,
          propertyId: data.propertyId ?? null,
        },
      });
    },

    async assignToRoom(ctx: TenantContext, roomId: string, amenityId: string) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, organizationId: ctx.organizationId },
      });
      if (!room) throw new CrossTenantViolationError("Room does not belong to your organization.");

      const amenity = await prisma.amenity.findFirst({
        where: { id: amenityId, organizationId: ctx.organizationId },
      });
      if (!amenity) throw new CrossTenantViolationError("Amenity does not belong to your organization.");

      return prisma.roomAmenity.upsert({
        where: {
          roomId_amenityId: { roomId, amenityId },
        },
        update: {},
        create: {
          organizationId: ctx.organizationId,
          roomId,
          amenityId,
        },
      });
    },

    async removeFromRoom(ctx: TenantContext, roomId: string, amenityId: string) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, organizationId: ctx.organizationId },
      });
      if (!room) throw new CrossTenantViolationError("Room does not belong to your organization.");

      return prisma.roomAmenity.deleteMany({
        where: {
          organizationId: ctx.organizationId,
          roomId,
          amenityId,
        },
      });
    },
  },

  onboarding: {
    async setupProperty(
      ctx: TenantContext,
      data: {
        property: {
          name: string;
          code?: string;
          city?: string | null;
          country?: string | null;
          currency?: string;
          timezone?: string;
          checkInTime?: number;
          checkOutTime?: number;
          taxRate?: Prisma.Decimal | string | number;
          cleaningFee?: Prisma.Decimal | string | number;
        };
        roomTypes: Array<{
          name: string;
          capacity: number;
          bedType?: string;
          baseRate: Prisma.Decimal | string | number;
        }>;
        rooms: Array<{
          number: string;
          floor?: string;
          roomTypeName: string;
        }>;
        ratePlans?: Array<{
          name: string;
          amount: Prisma.Decimal | string | number;
          type?: "fixed" | "percentage_modifier" | "seasonal";
        }>;
      },
    ) {
      return prisma.$transaction(async (tx) => {
        // 1. Create property
        const property = await tx.property.create({
          data: {
            organizationId: ctx.organizationId,
            name: data.property.name,
            code: data.property.code ?? "PROP",
            city: data.property.city ?? null,
            country: data.property.country ?? null,
            currency: data.property.currency ?? "USD",
            timezone: data.property.timezone ?? "UTC",
            checkInTime: data.property.checkInTime ?? 15,
            checkOutTime: data.property.checkOutTime ?? 11,
            taxRate: new Prisma.Decimal(data.property.taxRate ?? 0),
            cleaningFee: new Prisma.Decimal(data.property.cleaningFee ?? 0),
            status: "active",
          },
        });

        // 2. Create room types
        const createdRoomTypes: Record<string, string> = {};
        for (const rt of data.roomTypes) {
          const created = await tx.roomType.create({
            data: {
              organizationId: ctx.organizationId,
              propertyId: property.id,
              name: rt.name,
              capacity: rt.capacity,
              bedType: rt.bedType ?? "King",
              baseRate: new Prisma.Decimal(rt.baseRate),
              status: "active",
            },
          });
          createdRoomTypes[rt.name] = created.id;
        }

        // 3. Create rooms
        const createdRooms = [];
        for (const r of data.rooms) {
          const roomTypeId = createdRoomTypes[r.roomTypeName];
          if (!roomTypeId) {
            throw new Error(`Room type "${r.roomTypeName}" not found in setup definition.`);
          }
          const room = await tx.room.create({
            data: {
              organizationId: ctx.organizationId,
              propertyId: property.id,
              roomTypeId,
              number: r.number,
              floor: r.floor ?? "1",
              status: "available",
            },
          });
          createdRooms.push(room);
        }

        // 4. Create rate plans
        const createdRatePlans = [];
        const plansToCreate = data.ratePlans?.length
          ? data.ratePlans
          : [{ name: "Standard Daily Rate", amount: data.roomTypes[0]?.baseRate ?? 100, type: "fixed" as const }];

        for (const rp of plansToCreate) {
          const plan = await tx.ratePlan.create({
            data: {
              organizationId: ctx.organizationId,
              propertyId: property.id,
              name: rp.name,
              amount: new Prisma.Decimal(rp.amount),
              type: rp.type ?? "fixed",
              currency: property.currency,
              isActive: true,
            },
          });
          createdRatePlans.push(plan);
        }

        return {
          property,
          roomTypes: Object.entries(createdRoomTypes).map(([name, id]) => ({ id, name })),
          rooms: createdRooms,
          ratePlans: createdRatePlans,
        };
      });
    },
  },
};
