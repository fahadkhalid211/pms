import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createReservation, nightsBetween } from "@/lib/reservations";
import { calculateStayPrice } from "@/lib/pricing/engine";
import { logActivity } from "@/lib/audit";

export interface PublicSearchInput {
  organizationId: string;
  propertyId?: string;
  checkIn: Date | string;
  checkOut: Date | string;
  adults?: number;
  children?: number;
}

export interface PublicBookingInput {
  organizationId: string;
  propertyId: string;
  roomTypeId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  adults?: number;
  children?: number;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  notes?: string;
}

export interface OnlineCheckInInput {
  organizationId: string;
  bookingCode: string;
  email: string;
  estimatedArrival?: string;
  idVerifiedAck?: boolean;
  emergencyContact?: string;
  preferences?: Record<string, unknown>;
  specialRequests?: string;
}

/**
 * Public search for available rooms, room types, and price quotes.
 */
export async function searchAvailableRooms(input: PublicSearchInput) {
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  const nights = nightsBetween(checkIn, checkOut);

  if (nights <= 0) {
    throw new Error("Check-out date must be after check-in date.");
  }

  const whereProperty: Prisma.PropertyWhereInput = {
    organizationId: input.organizationId,
    ...(input.propertyId ? { id: input.propertyId } : {}),
  };

  const properties = await prisma.property.findMany({
    where: whereProperty,
    include: {
      roomTypes: true,
      rooms: {
        where: { status: { not: "out_of_service" } },
      },
      ratePlans: {
        where: { isActive: true },
        include: { seasons: true },
      },
    },
  });

  const results: Array<{
    propertyId: string;
    propertyName: string;
    currency: string;
    roomTypeId: string;
    roomTypeName: string;
    capacity: number;
    availableRoomCount: number;
    priceQuote: {
      basePrice: string;
      taxes: string;
      fees: string;
      total: string;
      nights: number;
    };
  }> = [];

  for (const property of properties) {
    // Check conflicts across all rooms
    const conflictedBookings = await prisma.roomNight.findMany({
      where: {
        roomId: { in: property.rooms.map((r) => r.id) },
        date: { gte: checkIn, lt: checkOut },
      },
      select: { roomId: true },
    });

    const conflictedRoomIds = new Set(conflictedBookings.map((b) => b.roomId));

    for (const roomType of property.roomTypes) {
      if (input.adults && roomType.capacity < input.adults) continue;

      const matchingRooms = property.rooms.filter((r) => r.roomTypeId === roomType.id);
      const availableRooms = matchingRooms.filter((r) => !conflictedRoomIds.has(r.id));

      if (availableRooms.length === 0) continue;

      // Calculate stay price quote
      const activeRatePlan = property.ratePlans[0];
      const quote = calculateStayPrice({
        baseRate: roomType.baseRate,
        checkIn,
        checkOut,
        adults: input.adults ?? 2,
        capacity: roomType.capacity,
        taxRatePercent: property.taxRate,
        cleaningFee: property.cleaningFee,
        ratePlan: activeRatePlan
          ? {
              id: activeRatePlan.id,
              name: activeRatePlan.name,
              amount: activeRatePlan.amount,
              seasons: activeRatePlan.seasons.map((s) => ({
                id: s.id,
                startDate: s.startDate,
                endDate: s.endDate,
                amount: s.amount,
              })),
            }
          : null,
      });

      results.push({
        propertyId: property.id,
        propertyName: property.name,
        currency: property.currency,
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
        capacity: roomType.capacity,
        availableRoomCount: availableRooms.length,
        priceQuote: {
          basePrice: quote.nightlySubtotal,
          taxes: quote.taxAmount,
          fees: quote.cleaningFee,
          total: quote.grandTotal,
          nights,
        },
      });
    }
  }

  return results;
}

/**
 * Public booking creation (creates or connects Guest, Reservation, and RoomNights atomically).
 */
export async function createPublicBooking(input: PublicBookingInput) {
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);

  // Find an available room of the requested room type
  const rooms = await prisma.room.findMany({
    where: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      status: { not: "out_of_service" },
    },
  });

  const conflicts = await prisma.roomNight.findMany({
    where: {
      roomId: { in: rooms.map((r) => r.id) },
      date: { gte: checkIn, lt: checkOut },
    },
    select: { roomId: true },
  });

  const busyIds = new Set(conflicts.map((c) => c.roomId));
  const availableRoom = rooms.find((r) => !busyIds.has(r.id));

  if (!availableRoom) {
    throw new Error("No rooms available for the selected dates and room category.");
  }

  // Create or resolve Guest
  let guest = await prisma.guest.findFirst({
    where: {
      organizationId: input.organizationId,
      email: { equals: input.guest.email.trim() },
    },
  });

  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        organizationId: input.organizationId,
        firstName: input.guest.firstName.trim(),
        lastName: input.guest.lastName.trim(),
        email: input.guest.email.trim().toLowerCase(),
        phone: input.guest.phone,
      },
    });

    // Create GuestProfile
    await prisma.guestProfile.create({
      data: {
        organizationId: input.organizationId,
        guestId: guest.id,
        loyaltyTier: "standard",
      },
    });
  }

  // Create reservation through core engine
  const result = await createReservation({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    roomIds: [availableRoom.id],
    checkIn,
    checkOut,
    adults: input.adults ?? 1,
    children: input.children ?? 0,
    guestId: guest.id,
    source: "public_portal",
    notes: input.notes,
    status: "confirmed",
  });

  await logActivity({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    source: "backend",
    category: "reservation",
    action: "portal.booking_created",
    summary: `Public booking ${result.reservation.code} created for ${guest.firstName} ${guest.lastName}.`,
    entityType: "Reservation",
    entityId: result.reservation.id,
  });

  return {
    reservation: result.reservation,
    bookingCode: result.reservation.code,
    roomNumber: availableRoom.number,
    guest,
  };
}

/**
 * STRICT IDENTITY VERIFICATION GATE:
 * Looks up a reservation requiring BOTH bookingCode AND matching guest email.
 * Booking ref alone is denied. Cross-customer data leakage is strictly blocked.
 */
export async function verifyAndGetBooking(input: {
  organizationId: string;
  bookingCode: string;
  email?: string | null;
}) {
  if (!input.organizationId) {
    throw new Error("Organization ID is required.");
  }
  if (!input.bookingCode || !input.bookingCode.trim()) {
    throw new Error("Booking confirmation code is required.");
  }

  // Ref alone is DENIED!
  if (!input.email || !input.email.trim()) {
    throw new Error("Identity verification failed: Booking reference alone is denied. Guest email is required for access.");
  }

  const reservation = await prisma.reservation.findFirst({
    where: {
      organizationId: input.organizationId,
      code: input.bookingCode.trim(),
      guest: {
        email: {
          equals: input.email.trim(),
        },
      },
    },
    include: {
      guest: true,
      property: true,
      rooms: {
        include: {
          room: {
            include: { roomType: true },
          },
        },
      },
      invoices: {
        include: { payments: true },
      },
      requests: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!reservation) {
    throw new Error("Verification failed: No booking matching reference and email address found.");
  }

  return reservation;
}

/**
 * Online Check-In Submission
 */
export async function submitOnlineCheckIn(input: OnlineCheckInInput) {
  const reservation = await verifyAndGetBooking({
    organizationId: input.organizationId,
    bookingCode: input.bookingCode,
    email: input.email,
  });

  if (reservation.status !== "confirmed") {
    throw new Error(`Cannot submit online check-in for reservation in '${reservation.status}' status.`);
  }

  const checkInData = {
    estimatedArrival: input.estimatedArrival ?? "15:00",
    idVerifiedAck: input.idVerifiedAck ?? true,
    emergencyContact: input.emergencyContact,
    specialRequests: input.specialRequests,
    preferences: input.preferences,
    submittedAt: new Date().toISOString(),
  };

  const request = await prisma.guestRequest.create({
    data: {
      organizationId: input.organizationId,
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      guestId: reservation.guestId!,
      type: "online_checkin",
      content: JSON.stringify(checkInData),
      status: "completed",
    },
  });

  // Update Guest Profile preferences if provided
  if (reservation.guestId && input.preferences) {
    await prisma.guestProfile.updateMany({
      where: { guestId: reservation.guestId, organizationId: input.organizationId },
      data: { preferences: input.preferences as Prisma.InputJsonObject },
    });
  }

  await logActivity({
    organizationId: input.organizationId,
    propertyId: reservation.propertyId,
    source: "backend",
    category: "operations",
    action: "portal.online_checkin",
    summary: `Online check-in completed for booking ${reservation.code} (ETA: ${checkInData.estimatedArrival}).`,
    entityType: "GuestRequest",
    entityId: request.id,
  });

  return {
    ok: true,
    bookingCode: reservation.code,
    message: "Online check-in successfully confirmed. Front desk has been notified of your arrival.",
  };
}

/**
 * Cancellation Request via Guest Portal
 */
export async function submitCancellationRequest(input: {
  organizationId: string;
  bookingCode: string;
  email: string;
  reason?: string;
}) {
  const reservation = await verifyAndGetBooking({
    organizationId: input.organizationId,
    bookingCode: input.bookingCode,
    email: input.email,
  });

  if (reservation.status === "cancelled") {
    return { ok: true, message: "Reservation is already cancelled." };
  }

  // Calculate cancellation policy fee preview
  const hoursUntilCheckIn = (new Date(reservation.checkIn).getTime() - Date.now()) / (1000 * 60 * 60);
  const isLateCancellation = hoursUntilCheckIn < 24;
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const feeEstimate = isLateCancellation && nights > 0
    ? (Number(reservation.totalAmount) / nights).toFixed(2)
    : "0.00";

  const request = await prisma.guestRequest.create({
    data: {
      organizationId: input.organizationId,
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      guestId: reservation.guestId!,
      type: "cancellation_request",
      content: JSON.stringify({
        reason: input.reason ?? "Guest requested cancellation via portal",
        feeEstimate,
        hoursUntilCheckIn: Math.round(hoursUntilCheckIn),
      }),
      status: "pending",
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    propertyId: reservation.propertyId,
    source: "backend",
    category: "reservation",
    action: "portal.cancellation_requested",
    summary: `Guest requested cancellation for booking ${reservation.code} (Fee estimate: ${reservation.currency} ${feeEstimate}).`,
    entityType: "GuestRequest",
    entityId: request.id,
  });

  return {
    ok: true,
    bookingCode: reservation.code,
    feeEstimate: `${reservation.currency} ${feeEstimate}`,
    message: "Cancellation request received and forwarded to management.",
  };
}

/**
 * Send Guest Message / Special Request to Front Desk
 */
export async function sendGuestPortalMessage(input: {
  organizationId: string;
  bookingCode: string;
  email: string;
  message: string;
}) {
  const reservation = await verifyAndGetBooking({
    organizationId: input.organizationId,
    bookingCode: input.bookingCode,
    email: input.email,
  });

  const request = await prisma.guestRequest.create({
    data: {
      organizationId: input.organizationId,
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      guestId: reservation.guestId!,
      type: "guest_message",
      content: input.message,
      status: "pending",
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    propertyId: reservation.propertyId,
    source: "backend",
    category: "operations",
    action: "portal.message_sent",
    summary: `Guest message for booking ${reservation.code}: ${input.message.slice(0, 50)}...`,
    entityType: "GuestRequest",
    entityId: request.id,
  });

  return { ok: true, requestId: request.id };
}

/**
 * List all bookings for a verified customer email.
 */
export async function getCustomerBookings(organizationId: string, email: string) {
  if (!organizationId || !email) return [];

  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId,
      guest: {
        email: {
          equals: email.trim(),
        },
      },
    },
    orderBy: { checkIn: "desc" },
    include: {
      property: { select: { id: true, name: true, currency: true } },
      rooms: { include: { room: { select: { number: true } } } },
    },
  });

  return reservations.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    propertyName: r.property.name,
    currency: r.property.currency,
    checkIn: r.checkIn.toISOString().split("T")[0],
    checkOut: r.checkOut.toISOString().split("T")[0],
    rooms: r.rooms.map((rm) => rm.room.number).join(", "),
    totalAmount: r.totalAmount.toString(),
  }));
}
