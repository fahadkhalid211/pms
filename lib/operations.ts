import { prisma } from "@/lib/db";
import { Prisma, RoomStatus, HousekeepingStatus, TaskPriority, MaintenanceStatus, MaintenancePriority } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { NotFoundError, CrossTenantViolationError, DoubleBookingConflictError } from "@/lib/errors";
export { NotFoundError, CrossTenantViolationError, DoubleBookingConflictError };

export class IdVerificationRequiredError extends Error {
  constructor(message = "Guest identity verification is required prior to check-in.") {
    super(message);
    this.name = "IdVerificationRequiredError";
  }
}

export class OutstandingBalanceError extends Error {
  public balance: string;
  constructor(message: string, balance: string) {
    super(message);
    this.name = "OutstandingBalanceError";
    this.balance = balance;
  }
}

export class RoomNotReadyError extends Error {
  public roomNumber: string;
  public roomStatus: string;
  constructor(message: string, roomNumber: string, roomStatus: string) {
    super(message);
    this.name = "RoomNotReadyError";
    this.roomNumber = roomNumber;
    this.roomStatus = roomStatus;
  }
}

export class MaintenanceCollisionError extends Error {
  constructor(message = "Cannot block room for maintenance: Room has active reservations during this window.") {
    super(message);
    this.name = "MaintenanceCollisionError";
  }
}

export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOperationError";
  }
}

function getStayDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const targetEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (current < targetEnd) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export interface CheckInOptions {
  idVerified?: boolean;
  idDocumentDetails?: {
    type: string;
    number: string;
  };
  allowOutstandingBalance?: boolean;
  notes?: string;
  staffUserId?: string;
}

/**
 * Executes guest check-in adhering to ID verification, balance settlement,
 * and room cleanliness rules.
 */
export async function checkInGuest(
  reservationId: string,
  organizationId: string,
  options: CheckInOptions = {},
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, organizationId },
    include: {
      guest: { include: { profile: true } },
      rooms: { include: { room: true } },
      invoices: { include: { payments: true } },
      property: true,
    },
  });

  if (!reservation) {
    throw new NotFoundError("Reservation not found.");
  }

  if (reservation.status !== "confirmed") {
    throw new InvalidOperationError(`Cannot check in reservation with status '${reservation.status}'. Only confirmed reservations can be checked in.`);
  }

  // 1. ID Verification Check
  const hasVerifiedProfile = Boolean(reservation.guest?.profile?.idDocumentNumber || reservation.guest?.profile?.idVerified);
  const idVerifiedNow = Boolean(options.idVerified || options.idDocumentDetails?.number);

  if (!hasVerifiedProfile && !idVerifiedNow) {
    throw new IdVerificationRequiredError("Guest identity verification is required prior to check-in. Present government ID or record verification.");
  }

  // 2. Financial Balance Verification
  let totalBilled = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);

  if (reservation.invoices.length > 0) {
    for (const inv of reservation.invoices) {
      if (inv.status !== "void" && inv.status !== "refunded") {
        totalBilled = totalBilled.plus(new Prisma.Decimal(inv.total));
        for (const pay of inv.payments) {
          if (pay.status === "captured") {
            totalPaid = totalPaid.plus(new Prisma.Decimal(pay.amount));
          }
        }
      }
    }
  } else {
    // If no invoices yet, compare reservation total against direct payments
    totalBilled = new Prisma.Decimal(reservation.totalAmount);
    const directPayments = await prisma.payment.findMany({
      where: { reservationId: reservation.id, status: "captured" },
    });
    for (const pay of directPayments) {
      totalPaid = totalPaid.plus(new Prisma.Decimal(pay.amount));
    }
  }

  const outstandingBalance = totalBilled.minus(totalPaid);
  if (outstandingBalance.greaterThan(0) && !options.allowOutstandingBalance) {
    throw new OutstandingBalanceError(
      `Reservation has an outstanding balance of $${outstandingBalance.toFixed(2)}. Settle payment or obtain manager override.`,
      outstandingBalance.toFixed(2),
    );
  }

  // 3. Room Readiness Check
  for (const r of reservation.rooms) {
    const s = r.room.status;
    if (s === "dirty" || s === "out_of_service" || s === "occupied") {
      throw new RoomNotReadyError(
        `Room ${r.room.number} is currently '${s}' and not ready for check-in. Room must be clean or inspected.`,
        r.room.number,
        s,
      );
    }
  }

  // 4. Perform Check-in Atomically
  const updated = await prisma.$transaction(async (tx) => {
    // Update reservation status
    const res = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "checked_in",
        notes: options.notes ? `${reservation.notes ? reservation.notes + "\n" : ""}[Check-in]: ${options.notes}` : undefined,
      },
      include: {
        guest: true,
        rooms: { include: { room: true } },
      },
    });

    // Mark all rooms as occupied
    for (const r of reservation.rooms) {
      await tx.room.update({
        where: { id: r.room.id },
        data: { status: "occupied" },
      });
    }

    // Record ID verification on guest profile if details provided
    if (reservation.guestId && options.idDocumentDetails) {
      await tx.guestProfile.upsert({
        where: { guestId: reservation.guestId },
        update: {
          idDocumentType: options.idDocumentDetails.type,
          idDocumentNumber: options.idDocumentDetails.number,
          idVerified: true,
        },
        create: {
          organizationId: reservation.organizationId,
          guestId: reservation.guestId,
          idDocumentType: options.idDocumentDetails.type,
          idDocumentNumber: options.idDocumentDetails.number,
          idVerified: true,
        },
      });
    }

    return res;
  });

  // 5. Audit Log & Notification
  await auditLog({
    userId: options.staffUserId,
    organizationId,
    propertyId: reservation.propertyId,
    action: "reservation.checked_in",
    entityType: "Reservation",
    entityId: reservation.id,
    metadata: {
      code: reservation.code,
      guestId: reservation.guestId,
      idVerified: true,
      balance: outstandingBalance.toFixed(2),
      rooms: reservation.rooms.map((r) => r.room.number),
    },
  });

  await createNotification({
    organizationId,
    propertyId: reservation.propertyId,
    type: "reservation_checked_in",
    payload: {
      reservationId: reservation.id,
      code: reservation.code,
      guestName: reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : "Guest",
    },
    relatedType: "Reservation",
    relatedId: reservation.id,
  });

  return updated;
}

export interface CheckOutOptions {
  notes?: string;
  staffUserId?: string;
  forceUnsettled?: boolean;
}

/**
 * Executes guest checkout, releasing rooms, setting them to 'dirty',
 * and automatically generating turnover housekeeping tasks.
 */
export async function checkOutGuest(
  reservationId: string,
  organizationId: string,
  options: CheckOutOptions = {},
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, organizationId },
    include: {
      guest: true,
      rooms: { include: { room: true } },
      invoices: { include: { payments: true } },
      property: true,
    },
  });

  if (!reservation) {
    throw new NotFoundError("Reservation not found.");
  }

  if (reservation.status !== "checked_in") {
    throw new InvalidOperationError(`Cannot check out reservation with status '${reservation.status}'. Only checked-in reservations can be checked out.`);
  }

  // Check unsettled balance warning
  let totalBilled = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);
  for (const inv of reservation.invoices) {
    if (inv.status !== "void" && inv.status !== "refunded") {
      totalBilled = totalBilled.plus(new Prisma.Decimal(inv.total));
      for (const pay of inv.payments) {
        if (pay.status === "captured") totalPaid = totalPaid.plus(new Prisma.Decimal(pay.amount));
      }
    }
  }

  const outstandingBalance = totalBilled.minus(totalPaid);
  if (outstandingBalance.greaterThan(0) && !options.forceUnsettled) {
    throw new OutstandingBalanceError(
      `Reservation has an outstanding balance of $${outstandingBalance.toFixed(2)}. Settle balance before checkout or confirm force checkout.`,
      outstandingBalance.toFixed(2),
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update reservation status
    const updated = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "checked_out",
        notes: options.notes ? `${reservation.notes ? reservation.notes + "\n" : ""}[Checkout]: ${options.notes}` : undefined,
      },
      include: {
        rooms: { include: { room: true } },
      },
    });

    const createdTasks = [];

    // 2. Transition rooms to 'dirty' and create auto turnover housekeeping tasks
    for (const r of reservation.rooms) {
      await tx.room.update({
        where: { id: r.room.id },
        data: { status: "dirty" },
      });

      const task = await tx.housekeepingTask.create({
        data: {
          organizationId,
          propertyId: reservation.propertyId,
          roomId: r.room.id,
          title: `Turnover clean for Room ${r.room.number}`,
          notes: `Auto-generated upon checkout of reservation ${reservation.code}`,
          priority: "high",
          status: "pending",
          dueAt: new Date(Date.now() + 3 * 3600000), // 3 hours from checkout
        },
      });
      createdTasks.push(task);
    }

    return { reservation: updated, housekeepingTasks: createdTasks };
  });

  // 3. Audit Log & Notification
  await auditLog({
    userId: options.staffUserId,
    organizationId,
    propertyId: reservation.propertyId,
    action: "reservation.checked_out",
    entityType: "Reservation",
    entityId: reservation.id,
    metadata: {
      code: reservation.code,
      guestName: reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : "Guest",
      vacatedRooms: reservation.rooms.map((r) => r.room.number),
      tasksCreated: result.housekeepingTasks.length,
    },
  });

  await createNotification({
    organizationId,
    propertyId: reservation.propertyId,
    type: "reservation_checked_out",
    payload: {
      reservationId: reservation.id,
      code: reservation.code,
      vacatedRooms: reservation.rooms.map((r) => r.room.number),
    },
    relatedType: "Reservation",
    relatedId: reservation.id,
  });

  return result;
}

/**
 * Moves/reassigns a reservation room to a new target room, transferring
 * inventory nights and maintaining room status integrity.
 */
export async function reassignRoom(
  reservationId: string,
  currentRoomId: string,
  targetRoomId: string,
  organizationId: string,
  staffUserId?: string,
) {
  if (currentRoomId === targetRoomId) {
    throw new InvalidOperationError("Target room must be different from current room.");
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, organizationId },
    include: {
      rooms: { include: { room: true } },
      roomNights: { where: { roomId: currentRoomId } },
    },
  });

  if (!reservation) throw new NotFoundError("Reservation not found.");

  const currentAssigned = reservation.rooms.find((r) => r.roomId === currentRoomId);
  if (!currentAssigned) throw new InvalidOperationError(`Room ${currentRoomId} is not assigned to this reservation.`);

  const targetRoom = await prisma.room.findFirst({
    where: { id: targetRoomId, organizationId, propertyId: reservation.propertyId },
  });
  if (!targetRoom) throw new NotFoundError("Target room not found or belongs to a different property.");

  // Check target room readiness if currently checked in
  if (reservation.status === "checked_in" && (targetRoom.status === "dirty" || targetRoom.status === "out_of_service")) {
    throw new RoomNotReadyError(
      `Target room ${targetRoom.number} is ${targetRoom.status} and cannot be assigned immediately.`,
      targetRoom.number,
      targetRoom.status,
    );
  }

  // Calculate dates to transfer (from today onward, or full stay if in future)
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const stayDates = getStayDates(reservation.checkIn, reservation.checkOut);
  const remainingDates = stayDates.filter((d) => d >= todayUtc || reservation.status !== "checked_in");

  // Verify target room availability for remaining nights
  const targetConflicts = await prisma.roomNight.findMany({
    where: {
      roomId: targetRoomId,
      date: { in: remainingDates },
    },
  });

  if (targetConflicts.length > 0) {
    throw new DoubleBookingConflictError(`Target room ${targetRoom.number} is already booked or blocked on requested dates.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete RoomNight records for current room on remaining dates
    await tx.roomNight.deleteMany({
      where: {
        reservationId: reservation.id,
        roomId: currentRoomId,
        date: { in: remainingDates },
      },
    });

    // 2. Insert RoomNight records for target room on remaining dates
    for (const nightDate of remainingDates) {
      await tx.roomNight.create({
        data: {
          organizationId,
          propertyId: reservation.propertyId,
          roomId: targetRoomId,
          reservationId: reservation.id,
          date: nightDate,
          status: "reserved",
          price: currentAssigned.nightlyRate,
        },
      });
    }

    // 3. Update ReservationRoom record
    await tx.reservationRoom.update({
      where: { id: currentAssigned.id },
      data: { roomId: targetRoomId },
    });

    // 4. Update room physical statuses if currently checked-in
    if (reservation.status === "checked_in") {
      // Old room becomes dirty, new room becomes occupied
      await tx.room.update({
        where: { id: currentRoomId },
        data: { status: "dirty" },
      });
      await tx.room.update({
        where: { id: targetRoomId },
        data: { status: "occupied" },
      });

      // Auto-create cleaning task for previous room
      await tx.housekeepingTask.create({
        data: {
          organizationId,
          propertyId: reservation.propertyId,
          roomId: currentRoomId,
          title: `Cleaning - Room Move from ${currentAssigned.room.number} to ${targetRoom.number}`,
          notes: `Reservation ${reservation.code} transferred rooms.`,
          priority: "high",
          status: "pending",
        },
      });
    }

    return tx.reservation.findUnique({
      where: { id: reservation.id },
      include: { rooms: { include: { room: true } }, roomNights: true },
    });
  });

  await auditLog({
    userId: staffUserId,
    organizationId,
    propertyId: reservation.propertyId,
    action: "reservation.room_reassigned",
    entityType: "Reservation",
    entityId: reservation.id,
    metadata: {
      reservationCode: reservation.code,
      fromRoomId: currentRoomId,
      toRoomId: targetRoomId,
      targetRoomNumber: targetRoom.number,
    },
  });

  return result;
}

/**
 * Updates a housekeeping task and auto-transitions the room status
 * when the cleaning is marked 'completed' or 'inspected'.
 */
export async function updateHousekeepingTask(
  id: string,
  organizationId: string,
  data: {
    status?: HousekeepingStatus;
    priority?: TaskPriority;
    assigneeId?: string | null;
    notes?: string | null;
    title?: string | null;
  },
  staffUserId?: string,
) {
  const task = await prisma.housekeepingTask.findFirst({
    where: { id, organizationId },
    include: { room: true },
  });

  if (!task) throw new NotFoundError("Housekeeping task not found.");

  const updated = await prisma.$transaction(async (tx) => {
    const isCompleted = data.status === "completed";
    const completedAt = isCompleted ? new Date() : undefined;

    const res = await tx.housekeepingTask.update({
      where: { id },
      data: {
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        notes: data.notes,
        title: data.title,
        completedAt,
      },
      include: { room: true },
    });

    // Auto-transition room status:
    // When completed, if room is currently 'dirty', mark it as 'clean'
    if (isCompleted && task.room.status === "dirty") {
      await tx.room.update({
        where: { id: task.roomId },
        data: { status: "clean" },
      });
    }

    return res;
  });

  await auditLog({
    userId: staffUserId,
    organizationId,
    propertyId: task.propertyId,
    action: "housekeeping.task_updated",
    entityType: "HousekeepingTask",
    entityId: id,
    metadata: {
      newStatus: data.status,
      roomNumber: task.room.number,
    },
  });

  if (data.status === "completed") {
    await createNotification({
      organizationId,
      propertyId: task.propertyId,
      type: "housekeeping_task_completed",
      payload: { taskId: id, roomNumber: task.room.number },
      relatedType: "HousekeepingTask",
      relatedId: id,
    });
  }

  return updated;
}

export interface CreateMaintenanceTicketInput {
  organizationId: string;
  propertyId: string;
  roomId?: string | null;
  priority?: MaintenancePriority;
  description: string;
  assigneeId?: string | null;
  blockRoom?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
  createdBy?: string | null;
}

/**
 * Creates a maintenance ticket and optionally places an inventory block
 * (RoomNight records with status 'maintenance') removing room availability.
 */
export async function createMaintenanceTicket(
  input: CreateMaintenanceTicketInput,
) {
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, organizationId: input.organizationId },
  });
  if (!property) throw new CrossTenantViolationError("Property does not belong to your organization.");

  let room = null;
  if (input.roomId) {
    room = await prisma.room.findFirst({
      where: { id: input.roomId, organizationId: input.organizationId, propertyId: input.propertyId },
    });
    if (!room) throw new CrossTenantViolationError("Room does not belong to your organization or property.");
  }

  // If room blocking is requested:
  let blockDates: Date[] = [];
  if (input.blockRoom && input.roomId) {
    const start = input.startDate ? new Date(input.startDate) : new Date();
    const end = input.endDate ? new Date(input.endDate) : new Date(Date.now() + 86400000); // 1 night default

    blockDates = getStayDates(start, end);

    // Check if room has any active reservations during the block window
    const reservationConflicts = await prisma.roomNight.findMany({
      where: {
        roomId: input.roomId,
        date: { in: blockDates },
        status: "reserved",
      },
    });

    if (reservationConflicts.length > 0) {
      throw new MaintenanceCollisionError(`Cannot block room ${room?.number}: Active reservation conflicts with requested maintenance dates.`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const ticket = await tx.maintenanceTicket.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        roomId: input.roomId ?? undefined,
        status: "open",
        priority: input.priority ?? "normal",
        description: input.description,
        assigneeId: input.assigneeId ?? undefined,
        createdBy: input.createdBy ?? undefined,
      },
      include: { room: true },
    });

    if (input.blockRoom && input.roomId && blockDates.length > 0) {
      // 1. Create RoomNight records with status 'maintenance'
      for (const d of blockDates) {
        await tx.roomNight.create({
          data: {
            organizationId: input.organizationId,
            propertyId: input.propertyId,
            roomId: input.roomId,
            date: d,
            status: "maintenance",
            price: new Prisma.Decimal(0),
          },
        });
      }

      // 2. Update room physical status to out_of_service
      await tx.room.update({
        where: { id: input.roomId },
        data: { status: "out_of_service" },
      });
    }

    return ticket;
  });

  await auditLog({
    userId: input.createdBy ?? undefined,
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    action: "maintenance.ticket_created",
    entityType: "MaintenanceTicket",
    entityId: result.id,
    metadata: {
      description: input.description,
      priority: input.priority,
      roomNumber: room?.number,
      blockedInventory: input.blockRoom,
    },
  });

  if (input.priority === "emergency" || input.priority === "high") {
    await createNotification({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      type: "maintenance_urgent_ticket",
      payload: {
        ticketId: result.id,
        roomNumber: room?.number,
        description: input.description,
        priority: input.priority,
      },
      relatedType: "MaintenanceTicket",
      relatedId: result.id,
    });
  }

  return result;
}

/**
 * Updates a maintenance ticket. When resolved or cancelled, any inventory
 * maintenance blocks are deleted and room status is restored to operational.
 */
export async function updateMaintenanceTicket(
  id: string,
  organizationId: string,
  data: {
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
    assigneeId?: string | null;
    description?: string;
  },
  staffUserId?: string,
) {
  const ticket = await prisma.maintenanceTicket.findFirst({
    where: { id, organizationId },
    include: { room: true },
  });

  if (!ticket) throw new NotFoundError("Maintenance ticket not found.");

  const isResolvedOrCancelled = data.status === "resolved" || data.status === "cancelled";

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        description: data.description,
        resolvedAt: data.status === "resolved" ? new Date() : undefined,
      },
      include: { room: true },
    });

    // If ticket is resolved/cancelled and was associated with a room:
    if (isResolvedOrCancelled && ticket.roomId) {
      // 1. Remove any maintenance RoomNight blocks
      await tx.roomNight.deleteMany({
        where: {
          roomId: ticket.roomId,
          status: "maintenance",
        },
      });

      // 2. Restore room status if currently out_of_service
      if (ticket.room?.status === "out_of_service") {
        await tx.room.update({
          where: { id: ticket.roomId },
          data: { status: "clean" },
        });
      }
    }

    return res;
  });

  await auditLog({
    userId: staffUserId,
    organizationId,
    propertyId: ticket.propertyId,
    action: "maintenance.ticket_updated",
    entityType: "MaintenanceTicket",
    entityId: id,
    metadata: {
      status: data.status,
      roomNumber: ticket.room?.number,
    },
  });

  return updated;
}

/**
 * Direct room status transition controller enforcing PMS business rules.
 */
export async function updateRoomStatus(
  roomId: string,
  organizationId: string,
  newStatus: RoomStatus,
  staffUserId?: string,
) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, organizationId },
  });

  if (!room) throw new NotFoundError("Room not found.");

  // Enforce status transition constraints
  if (room.status === "occupied" && newStatus === "available") {
    throw new InvalidOperationError("Cannot directly mark an occupied room as available. Complete guest checkout instead.");
  }

  if (room.status !== "occupied" && newStatus === "occupied") {
    throw new InvalidOperationError("Cannot directly mark room as occupied. Perform guest check-in instead.");
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { status: newStatus },
  });

  await auditLog({
    userId: staffUserId,
    organizationId,
    propertyId: room.propertyId,
    action: "room.status_updated",
    entityType: "Room",
    entityId: roomId,
    metadata: {
      roomNumber: room.number,
      previousStatus: room.status,
      newStatus,
    },
  });

  return updated;
}
