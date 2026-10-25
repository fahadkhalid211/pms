import crypto from "crypto";
import { Prisma, type ReservationStatus, type ReservationSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { calculateStayPrice } from "@/lib/pricing/engine";
import { toISODate } from "@/lib/utils";

export const RESERVATION_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
];

export const VALID_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  draft: ["pending", "confirmed", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [], // terminal
  cancelled: [], // terminal
  no_show: [], // terminal
};

import { DoubleBookingConflictError, NotFoundError, CrossTenantViolationError } from "@/lib/errors";
export { DoubleBookingConflictError, NotFoundError, CrossTenantViolationError };

export class InvalidStatusTransitionError extends Error {
  status = 400;
  code = "INVALID_STATUS_TRANSITION";
  constructor(from: string, to: string) {
    super(`Cannot transition reservation status from "${from}" to "${to}".`);
    this.status = 400;
  }
}

export class InvalidDatesError extends Error {
  status = 400;
  code = "INVALID_DATES";
  constructor(message = "Check-out date must be strictly after check-in date.") {
    super(message);
    this.status = 400;
  }
}

export function generateBookingCode(): string {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `LMN-${time}-${rand}`;
}

export function toUtcMidnight(d: Date | string): Date {
  if (typeof d === "string") {
    const parts = d.split("T")[0].split("-");
    if (parts.length === 3) {
      return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    }
  }
  const obj = new Date(d);
  return new Date(Date.UTC(obj.getUTCFullYear(), obj.getUTCMonth(), obj.getUTCDate()));
}

export function nightsBetween(checkIn: Date | string, checkOut: Date | string): number {
  const start = toUtcMidnight(checkIn);
  const end = toUtcMidnight(checkOut);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function getStayDatesArray(checkIn: Date | string, checkOut: Date | string): Date[] {
  const start = toUtcMidnight(checkIn);
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) {
    throw new InvalidDatesError();
  }

  const dates: Date[] = [];
  const cur = new Date(start.getTime());
  for (let i = 0; i < nights; i++) {
    dates.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export interface CreateReservationInput {
  organizationId: string;
  propertyId: string;
  roomIds: string[];
  checkIn: Date | string;
  checkOut: Date | string;
  adults?: number;
  children?: number;
  guestId?: string | null;
  guest?: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  source?: ReservationSource;
  notes?: string | null;
  status?: ReservationStatus;
  ratePlanId?: string | null;
  discountCode?: string | null;
}

/**
 * Transactionally creates a reservation, allocates individual RoomNight rows
 * enforced by PostgreSQL unique constraints (roomId, date), preventing double-bookings.
 */
export async function createReservation(input: CreateReservationInput) {
  const checkInUtc = toUtcMidnight(input.checkIn);
  const checkOutUtc = toUtcMidnight(input.checkOut);
  const nights = nightsBetween(checkInUtc, checkOutUtc);

  if (nights <= 0) {
    throw new InvalidDatesError("Check-out date must be strictly after check-in date (minimum 1 night required).");
  }

  if (!input.roomIds || input.roomIds.length === 0) {
    throw new Error("At least one room must be selected for reservation.");
  }

  // 1. Verify Property belongs to organization
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, organizationId: input.organizationId },
  });
  if (!property) {
    throw new Error("Property does not belong to your organization.");
  }

  // 2. Verify all Rooms belong to organization & property
  const rooms = await prisma.room.findMany({
    where: {
      id: { in: input.roomIds },
      propertyId: input.propertyId,
      organizationId: input.organizationId,
    },
    include: { roomType: true },
  });

  if (rooms.length !== input.roomIds.length) {
    throw new Error("One or more selected rooms were not found or do not belong to the selected property.");
  }

  // 3. Resolve or Create Guest if guest object provided
  let resolvedGuestId = input.guestId ?? null;
  if (!resolvedGuestId && input.guest) {
    const createdGuest = await prisma.guest.create({
      data: {
        organizationId: input.organizationId,
        firstName: input.guest.firstName,
        lastName: input.guest.lastName,
        email: input.guest.email || null,
        phone: input.guest.phone || null,
      },
    });
    resolvedGuestId = createdGuest.id;
  }

  // 4. Calculate pricing for each room
  const stayDates = getStayDatesArray(checkInUtc, checkOutUtc);
  let totalReservationAmount = new Prisma.Decimal(0);
  const roomPricingMap = new Map<string, { nightlyRate: Prisma.Decimal; total: Prisma.Decimal }>();

  // Fetch optional rate plan if provided
  let ratePlan = null;
  if (input.ratePlanId) {
    ratePlan = await prisma.ratePlan.findFirst({
      where: { id: input.ratePlanId, organizationId: input.organizationId },
      include: { seasons: true },
    });
  }

  // Fetch discount if provided
  let discount = null;
  if (input.discountCode) {
    discount = await prisma.discount.findFirst({
      where: {
        organizationId: input.organizationId,
        code: { equals: input.discountCode.trim(), mode: "insensitive" },
      },
    });
  }

  for (const r of rooms) {
    const quote = calculateStayPrice({
      checkIn: checkInUtc,
      checkOut: checkOutUtc,
      baseRate: r.roomType.baseRate,
      ratePlan: ratePlan
        ? {
            name: ratePlan.name,
            amount: ratePlan.amount,
            seasons: ratePlan.seasons.map((s) => ({
              startDate: s.startDate,
              endDate: s.endDate,
              amount: s.amount,
            })),
          }
        : null,
      discount: discount
        ? {
            code: discount.code,
            type: discount.type as "percent" | "fixed",
            value: discount.value,
          }
        : null,
      taxRatePercent: property.taxRate,
      cleaningFee: property.cleaningFee,
      adults: input.adults ?? 1,
      capacity: r.roomType.capacity,
    });

    const roomTotalDec = new Prisma.Decimal(quote.grandTotal);
    const nightlyAverage = roomTotalDec.dividedBy(nights).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    roomPricingMap.set(r.id, { nightlyRate: nightlyAverage, total: roomTotalDec });
    totalReservationAmount = totalReservationAmount.plus(roomTotalDec);
  }

  const bookingCode = generateBookingCode();
  const targetStatus = input.status ?? "confirmed";

  // 5. ACID Transaction: Insert Reservation, ReservationRooms, and RoomNights
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create reservation header
      const reservation = await tx.reservation.create({
        data: {
          organizationId: input.organizationId,
          propertyId: input.propertyId,
          code: bookingCode,
          status: targetStatus,
          checkIn: checkInUtc,
          checkOut: checkOutUtc,
          adults: input.adults ?? 1,
          children: input.children ?? 0,
          guestId: resolvedGuestId,
          source: input.source ?? "direct",
          notes: input.notes ?? null,
          totalAmount: totalReservationAmount,
          currency: property.currency,
        },
      });

      // Create ReservationRooms
      for (const r of rooms) {
        const pricing = roomPricingMap.get(r.id);
        await tx.reservationRoom.create({
          data: {
            organizationId: input.organizationId,
            reservationId: reservation.id,
            roomId: r.id,
            guestId: resolvedGuestId,
            nightlyRate: pricing?.nightlyRate ?? r.roomType.baseRate,
          },
        });
      }

      // If status is active (confirmed, pending, checked_in), allocate RoomNight inventory rows
      if (ACTIVE_RESERVATION_STATUSES.includes(targetStatus)) {
        for (const r of rooms) {
          const pricing = roomPricingMap.get(r.id);
          for (const nightDate of stayDates) {
            await tx.roomNight.create({
              data: {
                organizationId: input.organizationId,
                propertyId: input.propertyId,
                roomId: r.id,
                reservationId: reservation.id,
                date: nightDate,
                status: "reserved",
                price: pricing?.nightlyRate ?? r.roomType.baseRate,
              },
            });
          }
        }
      }

      return reservation;
    });

    await auditLog({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      action: "reservation.created",
      entityType: "Reservation",
      entityId: result.id,
      metadata: {
        code: result.code,
        rooms: input.roomIds,
        checkIn: toISODate(checkInUtc),
        checkOut: toISODate(checkOutUtc),
        total: totalReservationAmount.toFixed(2),
      },
    });

    const fullReservation = await getReservation(result.id, input.organizationId);
    return {
      ...fullReservation,
      reservation: fullReservation,
    };
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new DoubleBookingConflictError("One or more selected rooms are already reserved for the requested dates.");
    }
    throw error;
  }
}

/**
 * Updates dates, rooms, or status of an existing reservation while maintaining
 * RoomNight inventory integrity and enforcing the state machine.
 */
export async function updateReservation(
  id: string,
  organizationId: string,
  data: {
    status?: ReservationStatus;
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
  const existing = await prisma.reservation.findFirst({
    where: { id, organizationId },
    include: { rooms: true, roomNights: true, property: true },
  });

  if (!existing) {
    throw new Error("Reservation not found.");
  }

  // 1. Enforce State Machine Transitions
  if (data.status && data.status !== existing.status) {
    const allowed = VALID_STATUS_TRANSITIONS[existing.status];
    if (!allowed || !allowed.includes(data.status)) {
      throw new InvalidStatusTransitionError(existing.status, data.status);
    }
  }

  const newStatus = data.status ?? existing.status;
  const newCheckIn = data.checkIn ? toUtcMidnight(data.checkIn) : existing.checkIn;
  const newCheckOut = data.checkOut ? toUtcMidnight(data.checkOut) : existing.checkOut;
  const newRoomIds = data.roomIds ?? existing.rooms.map((r) => r.roomId);

  const datesChanged =
    data.checkIn !== undefined && toISODate(newCheckIn) !== toISODate(existing.checkIn) ||
    data.checkOut !== undefined && toISODate(newCheckOut) !== toISODate(existing.checkOut);
  const roomsChanged = data.roomIds !== undefined;

  const nights = nightsBetween(newCheckIn, newCheckOut);
  if (nights <= 0) {
    throw new InvalidDatesError();
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Case A: Reservation cancelled or marked no-show -> release all RoomNights
      if (newStatus === "cancelled" || newStatus === "no_show") {
        await tx.roomNight.deleteMany({
          where: { reservationId: existing.id, organizationId },
        });

        return tx.reservation.update({
          where: { id: existing.id },
          data: {
            status: newStatus,
            cancelledAt: new Date(),
            cancelledReason: data.cancelledReason ?? existing.cancelledReason,
            notes: data.notes !== undefined ? data.notes : existing.notes,
          },
          include: { guest: true, rooms: { include: { room: true } }, property: true, roomNights: { orderBy: { date: "asc" } } },
        });
      }

      // Case B: Dates or Rooms modified -> re-allocate RoomNights
      if (datesChanged || roomsChanged) {
        // Release previous RoomNights temporarily within transaction
        await tx.roomNight.deleteMany({
          where: { reservationId: existing.id, organizationId },
        });

        // If new rooms specified, update ReservationRooms
        if (roomsChanged) {
          await tx.reservationRoom.deleteMany({
            where: { reservationId: existing.id, organizationId },
          });
          for (const roomId of newRoomIds) {
            await tx.reservationRoom.create({
              data: {
                organizationId,
                reservationId: existing.id,
                roomId,
                guestId: existing.guestId,
                nightlyRate: 0,
              },
            });
          }
        }

        // Re-allocate RoomNight records for all rooms across new date span
        const newStayDates = getStayDatesArray(newCheckIn, newCheckOut);
        for (const roomId of newRoomIds) {
          for (const nightDate of newStayDates) {
            await tx.roomNight.create({
              data: {
                organizationId,
                propertyId: existing.propertyId,
                roomId,
                reservationId: existing.id,
                date: nightDate,
                status: "reserved",
                price: 0,
              },
            });
          }
        }
      }

      return tx.reservation.update({
        where: { id: existing.id },
        data: {
          status: newStatus,
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          adults: data.adults ?? existing.adults,
          children: data.children ?? existing.children,
          notes: data.notes !== undefined ? data.notes : existing.notes,
        },
        include: { guest: true, rooms: { include: { room: true } }, property: true, roomNights: { orderBy: { date: "asc" } } },
      });
    });

    await auditLog({
      userId,
      organizationId,
      propertyId: existing.propertyId,
      action: "reservation.updated",
      entityType: "Reservation",
      entityId: existing.id,
      metadata: {
        code: updated.code,
        status: updated.status,
        checkIn: toISODate(updated.checkIn),
        checkOut: toISODate(updated.checkOut),
      },
    });

    return updated;
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new DoubleBookingConflictError("Cannot extend or modify reservation: room is already reserved for the new dates.");
    }
    throw error;
  }
}

/**
 * Evaluates cancellation policy and cancels reservation, releasing room inventory.
 */
export async function cancelReservation(
  id: string,
  organizationId: string,
  reason?: string,
  userId?: string,
) {
  const existing = await getReservation(id, organizationId);
  if (existing.status === "cancelled") {
    return { reservation: existing, feeApplied: 0, message: "Reservation is already cancelled." };
  }

  // Calculate cancellation policy fee
  const now = new Date();
  const hoursUntilCheckIn = (new Date(existing.checkIn).getTime() - now.getTime()) / (1000 * 60 * 60);

  let cancellationFee = new Prisma.Decimal(0);
  if (hoursUntilCheckIn < 24) {
    // Late cancellation policy: 1 night accommodation charge
    const nights = nightsBetween(existing.checkIn, existing.checkOut);
    if (nights > 0) {
      cancellationFee = new Prisma.Decimal(existing.totalAmount).dividedBy(nights).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
  }

  const updated = await updateReservation(
    id,
    organizationId,
    {
      status: "cancelled",
      cancelledReason: reason ?? (hoursUntilCheckIn < 24 ? "Late cancellation fee applies" : "Standard guest cancellation"),
    },
    userId,
  );

  return {
    reservation: updated,
    feeApplied: cancellationFee.toNumber(),
    cancellationFeeFormatted: cancellationFee.toFixed(2),
    hoursUntilCheckIn: Math.round(hoursUntilCheckIn),
  };
}

export async function listReservations(params: {
  organizationId: string;
  propertyId?: string | null;
  status?: string;
  query?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where: Prisma.ReservationWhereInput = { organizationId: params.organizationId };

  if (params.propertyId) where.propertyId = params.propertyId;
  if (params.status) where.status = params.status as ReservationStatus;

  if (params.from || params.to) {
    where.checkIn = {};
    if (params.from) where.checkIn.gte = toUtcMidnight(params.from);
    if (params.to) where.checkIn.lte = toUtcMidnight(params.to);
  }

  if (params.query) {
    const q = params.query.trim();
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
      orderBy: { checkIn: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        property: { select: { id: true, name: true, code: true, currency: true } },
        guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        rooms: { include: { room: { include: { roomType: true } } } },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getReservation(id: string, organizationId: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id, organizationId },
    include: {
      property: true,
      guest: true,
      rooms: { include: { room: { include: { roomType: true } } } },
      roomNights: { orderBy: { date: "asc" } },
      invoices: { include: { lineItems: true, payments: true } },
    },
  });

  if (!reservation) {
    throw new Error("Reservation not found.");
  }
  return reservation;
}

/**
 * Checks if all requested rooms are completely free for the given date range.
 */
export async function checkRoomsAvailability(
  propertyId: string,
  organizationId: string,
  roomIds: string[],
  checkIn: Date | string,
  checkOut: Date | string,
) {
  const stayDates = getStayDatesArray(checkIn, checkOut);

  const bookedNights = await prisma.roomNight.findMany({
    where: {
      organizationId,
      propertyId,
      roomId: { in: roomIds },
      date: { in: stayDates },
      status: { in: ["reserved", "blocked", "maintenance"] },
    },
    select: { roomId: true, date: true },
  });

  const conflictsByRoom: Record<string, string[]> = {};
  for (const bn of bookedNights) {
    const dStr = toISODate(bn.date);
    if (!conflictsByRoom[bn.roomId]) conflictsByRoom[bn.roomId] = [];
    conflictsByRoom[bn.roomId].push(dStr);
  }

  return {
    isAvailable: bookedNights.length === 0,
    totalNights: stayDates.length,
    conflicts: conflictsByRoom,
  };
}
