import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { addDays, toISODate } from "@/lib/utils";
import type { ReservationStatus, ReservationSource } from "@prisma/client";

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export const ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed", "checked_in"] as const;

export function generateBookingCode(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LMN-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export async function roomIsAvailable(
  roomId: string,
  organizationId: string,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
) {
  const conflicts = await prisma.reservationRoom.findFirst({
    where: {
      roomId,
      reservation: {
        organizationId,
        propertyId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    },
    include: { reservation: { select: { id: true, code: true, checkIn: true, checkOut: true, status: true } } },
  });
  if (!conflicts) return true;
  const c = conflicts.reservation;
  const overlaps = checkIn < c.checkOut && checkOut > c.checkIn;
  return !overlaps;
}

export async function roomsAreAvailable(
  roomIds: string[],
  organizationId: string,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
): Promise<{ roomId: string; available: boolean }[]> {
  const rooms = await prisma.room.findMany({
    where: { id: { in: roomIds }, propertyId },
  });
  const results = [];
  for (const room of rooms) {
    const conflict = await prisma.reservationRoom.findFirst({
      where: {
        roomId: room.id,
        reservation: {
          organizationId,
          propertyId,
          status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        },
      },
      include: { reservation: { select: { id: true, code: true, checkIn: true, checkOut: true, status: true } } },
    });
    const overlaps = conflict ? checkIn < conflict.reservation.checkOut && checkOut > conflict.reservation.checkIn : false;
    results.push({ roomId: room.id, available: !overlaps });
  }
  return results;
}

export async function countReservationsForRoom(
  roomId: string,
  organizationId: string,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
) {
  return prisma.reservationRoom.count({
    where: {
      roomId,
      reservation: {
        organizationId,
        propertyId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      },
    },
  });
}

interface CreateReservationInput {
  organizationId: string;
  propertyId: string;
  roomIds: string[];
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  guestId?: string | null;
  source?: ReservationSource;
  notes?: string;
  status?: ReservationStatus;
}

export async function createReservation(input: CreateReservationInput) {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights <= 0) throw new Error("Checkout must be after check-in.");
  const totalGuests = input.adults + input.children;
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, organizationId: input.organizationId, status: "active" },
  });
  if (!property) throw new Error("Property not found.");

  const roomDetails = await prisma.room.findMany({
    where: { id: { in: input.roomIds }, propertyId: input.propertyId },
    include: { roomType: true },
  });
  if (roomDetails.length !== input.roomIds.length) throw new Error("One or more selected rooms were not found.");

  // Availability + conflict prevention inside a transaction.
  const result = await prisma.$transaction(async (tx) => {
    const active = await tx.reservation.findMany({
      where: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      },
      include: { rooms: { include: { room: true } } },
    });
    const conflicts: string[] = [];
    for (const res of active) {
      const overlaps = res.checkIn < input.checkOut && input.checkIn < res.checkOut;
      if (!overlaps) continue;
      for (const rr of res.rooms) {
        if (input.roomIds.includes(rr.roomId)) {
          conflicts.push(rr.roomId);
        }
      }
    }
    const available = roomDetails.filter((r) => !conflicts.includes(r.id));
    if (available.length !== roomDetails.length) {
      throw new Error("One or more rooms are not available for the selected dates.");
    }

    const reservation = await tx.reservation.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        code: generateBookingCode(),
        status: input.status ?? "confirmed",
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        children: input.children,
        guestId: input.guestId ?? null,
        source: input.source ?? "direct",
        notes: input.notes ?? null,
      },
    });
    for (const room of roomDetails) {
      await tx.reservationRoom.create({
        data: {
          organizationId: input.organizationId,
          reservationId: reservation.id,
          roomId: room.id,
          guestId: input.guestId ?? null,
        },
      });
    }
    return { reservation, roomDetails };
  });

  await auditLog({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    action: "reservation.created",
    entityType: "Reservation",
    entityId: result.reservation.id,
    metadata: { code: result.reservation.code, checkIn: toISODate(input.checkIn), checkOut: toISODate(input.checkOut) },
  });

  return { reservation: result.reservation, rooms: result.roomDetails };
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
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const where: any = { organizationId: params.organizationId };
  if (params.propertyId) where.propertyId = params.propertyId;
  if (params.status) where.status = params.status;
  if (params.from || params.to) {
    where.checkIn = {};
    if (params.from) where.checkIn.gte = new Date(`${params.from}T00:00:00`);
    if (params.to) where.checkIn.lte = new Date(`${params.to}T23:59:59`);
  }
  if (params.query) {
    where.OR = [
      { code: { contains: params.query, mode: "insensitive" } },
      { guests: { some: { firstName: { contains: params.query, mode: "insensitive" } } } },
    ];
  }
  const [items, total] = await prisma.$transaction([
    prisma.reservation.findMany({
      where,
      orderBy: { checkIn: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { property: { select: { id: true, name: true } }, guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
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
    },
  });
  if (!reservation) throw new Error("Reservation not found.");
  return reservation;
}
