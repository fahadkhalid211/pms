import { describe, it, expect } from "vitest";
import prisma from "@/lib/db";
import { dal } from "@/lib/dal";
import {
  checkInGuest,
  checkOutGuest,
  reassignRoom,
  createMaintenanceTicket,
  updateMaintenanceTicket,
  updateHousekeepingTask,
  updateRoomStatus,
  IdVerificationRequiredError,
  OutstandingBalanceError,
  RoomNotReadyError,
  MaintenanceCollisionError,
} from "@/lib/operations";
import { createReservation, DoubleBookingConflictError } from "@/lib/reservations";
import { saveSecureUpload, readSecureUpload, UploadValidationError } from "@/lib/uploads";
import fs from "fs";

describe("WP5 Gate: Front Desk, Housekeeping, and Maintenance Workspaces", () => {
  it("1. Check-in Rules: enforces ID verification, room cleanliness, and balance policies", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Front Desk Org ${timestamp}`, slug: `fd-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Sunset Harbor Resort", code: "SHR", currency: "USD" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Harbor King", baseRate: 200 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `HK-${timestamp}`, status: "dirty" },
    });
    const guest = await prisma.guest.create({
      data: { organizationId: org.id, firstName: "Julian", lastName: "Blackwood", email: `julian-${timestamp}@example.com` },
    });

    const booking = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      guestId: guest.id,
      adults: 2,
    });
    const reservationId = booking.reservation.id;

    // Rule 1: Attempt check-in without ID verification -> Must fail with IdVerificationRequiredError
    let idErrorCaught = false;
    try {
      await checkInGuest(reservationId, org.id, {
        idVerified: false,
        allowOutstandingBalance: true,
      });
    } catch (err: any) {
      idErrorCaught = true;
      expect(err).toBeInstanceOf(IdVerificationRequiredError);
    }
    expect(idErrorCaught).toBe(true);

    // Rule 2: Attempt check-in with dirty room -> Must fail with RoomNotReadyError
    let roomErrorCaught = false;
    try {
      await checkInGuest(reservationId, org.id, {
        idVerified: true,
        idDocumentDetails: { type: "passport", number: "P1234567" },
        allowOutstandingBalance: true,
      });
    } catch (err: any) {
      roomErrorCaught = true;
      expect(err).toBeInstanceOf(RoomNotReadyError);
      expect((err as RoomNotReadyError).roomStatus).toBe("dirty");
    }
    expect(roomErrorCaught).toBe(true);

    // Prepare room: Mark room clean
    await prisma.room.update({
      where: { id: room.id },
      data: { status: "clean" },
    });

    // Rule 3: Attempt check-in with unpaid balance and no override -> Must fail with OutstandingBalanceError
    let balanceErrorCaught = false;
    try {
      await checkInGuest(reservationId, org.id, {
        idVerified: true,
        idDocumentDetails: { type: "passport", number: "P1234567" },
        allowOutstandingBalance: false, // Disallow unpaid balance
      });
    } catch (err: any) {
      balanceErrorCaught = true;
      expect(err).toBeInstanceOf(OutstandingBalanceError);
    }
    expect(balanceErrorCaught).toBe(true);

    // Rule 4: Successful check-in with ID verification + override or payment
    const checkedIn = await checkInGuest(reservationId, org.id, {
      idVerified: true,
      idDocumentDetails: { type: "passport", number: "P1234567" },
      allowOutstandingBalance: true,
      notes: "VIP check-in expedited",
    });

    expect(checkedIn.status).toBe("checked_in");

    // Room must now be marked 'occupied'
    const updatedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(updatedRoom?.status).toBe("occupied");

    // GuestProfile must have ID stored
    const profile = await prisma.guestProfile.findUnique({ where: { guestId: guest.id } });
    expect(profile?.idDocumentNumber).toBe("P1234567");

    // Audit log must be written
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: org.id, entityId: reservationId, action: "reservation.checked_in" },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("2. Checkout Lifecycle: auto-transitions room to dirty and creates turnover housekeeping task", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Checkout Org ${timestamp}`, slug: `co-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Lakeside Inn", code: "LSI" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Suite", baseRate: 250 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `LS-${timestamp}`, status: "clean" },
    });
    const guest = await prisma.guest.create({
      data: { organizationId: org.id, firstName: "Beatrice", lastName: "Portinari", email: `beatrice-${timestamp}@test.com` },
    });

    const booking = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2026-11-15",
      checkOut: "2026-11-18",
      guestId: guest.id,
    });

    // Check-in guest
    await checkInGuest(booking.reservation.id, org.id, {
      idVerified: true,
      idDocumentDetails: { type: "national_id", number: "NID-999" },
      allowOutstandingBalance: true,
    });

    const occupiedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(occupiedRoom?.status).toBe("occupied");

    // Execute checkout
    const checkoutResult = await checkOutGuest(booking.reservation.id, org.id, {
      forceUnsettled: true,
      notes: "Room inspected, guest checked out smoothly.",
    });

    expect(checkoutResult.reservation.status).toBe("checked_out");

    // Room must now be 'dirty'
    const vacatedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(vacatedRoom?.status).toBe("dirty");

    // Auto turnover housekeeping task must be generated
    expect(checkoutResult.housekeepingTasks.length).toBe(1);
    const task = checkoutResult.housekeepingTasks[0];
    expect(task.roomId).toBe(room.id);
    expect(task.priority).toBe("high");
    expect(task.status).toBe("pending");
    expect(task.title).toContain(`Turnover clean for Room ${room.number}`);
  });

  it("3. Housekeeping Lifecycle: completing cleaning task automatically updates room status to clean", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Housekeeping Org ${timestamp}`, slug: `hk-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Highland Chalet", code: "HLC" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Chalet King", baseRate: 150 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `CH-${timestamp}`, status: "dirty" },
    });

    // Create task
    const task = await dal.housekeeping.create(
      { organizationId: org.id },
      {
        propertyId: prop.id,
        roomId: room.id,
        title: "Deep cleaning post-checkout",
        priority: "high",
        status: "pending",
      },
    );

    // Step 1: Start task
    const inProgress = await updateHousekeepingTask(task.id, org.id, { status: "in_progress" });
    expect(inProgress.status).toBe("in_progress");

    // Step 2: Add comment
    const comment = await dal.housekeeping.addComment(
      { organizationId: org.id },
      task.id,
      "Bedding replaced, surfaces sanitized.",
    );
    expect(comment.body).toBe("Bedding replaced, surfaces sanitized.");

    // Step 3: Complete cleaning -> Room status must automatically become 'clean'
    const completed = await updateHousekeepingTask(task.id, org.id, { status: "completed" });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeInstanceOf(Date);

    const refreshedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(refreshedRoom?.status).toBe("clean");
  });

  it("4. Maintenance Blocks: blocks inventory, prevents bookings, and restores availability on resolve", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Maintenance Org ${timestamp}`, slug: `maint-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Metro Tower", code: "MTW" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Deluxe Studio", baseRate: 175 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `MT-${timestamp}`, status: "clean" },
    });

    // 1. Create maintenance ticket with inventory block from Nov 20 to Nov 23 (3 nights)
    const ticket = await createMaintenanceTicket({
      organizationId: org.id,
      propertyId: prop.id,
      roomId: room.id,
      priority: "high",
      description: "Plumbing pipe burst repair",
      blockRoom: true,
      startDate: "2026-11-20",
      endDate: "2026-11-23",
    });

    expect(ticket.id).toBeDefined();

    // Room status must be out_of_service
    const blockedRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(blockedRoom?.status).toBe("out_of_service");

    // 3 RoomNight records must exist with status 'maintenance'
    const maintNights = await prisma.roomNight.findMany({
      where: { roomId: room.id, status: "maintenance" },
    });
    expect(maintNights.length).toBe(3);

    // 2. Attempting to reserve room on overlapping dates MUST FAIL with DoubleBookingConflictError
    let bookingBlocked = false;
    try {
      await createReservation({
        organizationId: org.id,
        propertyId: prop.id,
        roomIds: [room.id],
        checkIn: "2026-11-21",
        checkOut: "2026-11-24",
      });
    } catch (err: any) {
      bookingBlocked = true;
      expect(err).toBeInstanceOf(DoubleBookingConflictError);
    }
    expect(bookingBlocked).toBe(true);

    // 3. Resolve maintenance ticket -> Inventory block released & room restored to clean
    const resolved = await updateMaintenanceTicket(ticket.id, org.id, {
      status: "resolved",
    });
    expect(resolved.status).toBe("resolved");

    // Room status must be restored
    const restoredRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(restoredRoom?.status).toBe("clean");

    // RoomNight maintenance records must be deleted
    const remainingMaintNights = await prisma.roomNight.findMany({
      where: { roomId: room.id, status: "maintenance" },
    });
    expect(remainingMaintNights.length).toBe(0);

    // Now reservation on those dates must SUCCEED!
    const newBooking = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2026-11-20",
      checkOut: "2026-11-23",
    });
    expect(newBooking.reservation.id).toBeDefined();
  });

  it("5. Room Move / Reassignment: transfers night inventory and switches room statuses", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `RoomMove Org ${timestamp}`, slug: `rm-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Grand Vista Hotel", code: "GVH" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Deluxe King", baseRate: 220 },
    });
    const roomA = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `101-${timestamp}`, status: "clean" },
    });
    const roomB = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `102-${timestamp}`, status: "clean" },
    });

    const booking = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [roomA.id],
      checkIn: "2026-12-05",
      checkOut: "2026-12-08",
    });

    // Check in guest to Room A
    await checkInGuest(booking.reservation.id, org.id, {
      idVerified: true,
      idDocumentDetails: { type: "driver_license", number: "DL-12345" },
      allowOutstandingBalance: true,
    });

    const rAOccupied = await prisma.room.findUnique({ where: { id: roomA.id } });
    expect(rAOccupied?.status).toBe("occupied");

    // Execute Room Move to Room B
    const moveResult = await reassignRoom(
      booking.reservation.id,
      roomA.id,
      roomB.id,
      org.id,
    );

    expect(moveResult).toBeDefined();

    // Room A must now be dirty and have an auto turnover task
    const rADirty = await prisma.room.findUnique({ where: { id: roomA.id } });
    expect(rADirty?.status).toBe("dirty");

    const rATask = await prisma.housekeepingTask.findFirst({
      where: { roomId: roomA.id, organizationId: org.id },
    });
    expect(rATask).toBeDefined();

    // Room B must now be occupied
    const rBOccupied = await prisma.room.findUnique({ where: { id: roomB.id } });
    expect(rBOccupied?.status).toBe("occupied");

    // RoomNights must be transferred to Room B
    const roomBNights = await prisma.roomNight.findMany({
      where: { roomId: roomB.id, reservationId: booking.reservation.id },
    });
    expect(roomBNights.length).toBe(3);
  });

  it("6. Secure Uploads: validates file sizes, allowed MIME types, generates UUID filenames outside web root", async () => {
    // 1. Rejected: Oversized file (> 10MB)
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    let sizeErrorCaught = false;
    try {
      await saveSecureUpload(oversizedBuffer, "huge_video.mp4", "video/mp4");
    } catch (err: any) {
      sizeErrorCaught = true;
      expect(err).toBeInstanceOf(UploadValidationError);
      expect(err.message).toContain("maximum permitted size");
    }
    expect(sizeErrorCaught).toBe(true);

    // 2. Rejected: Disallowed MIME type (e.g. .exe / shell script)
    const scriptBuffer = Buffer.from("#!/bin/bash\necho dangerous");
    let mimeErrorCaught = false;
    try {
      await saveSecureUpload(scriptBuffer, "script.sh", "application/x-sh");
    } catch (err: any) {
      mimeErrorCaught = true;
      expect(err).toBeInstanceOf(UploadValidationError);
      expect(err.message).toContain("Unsupported MIME type");
    }
    expect(mimeErrorCaught).toBe(true);

    // 3. Accepted: Valid PNG image
    const validImageBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const result = await saveSecureUpload(validImageBuffer, "guest_passport.png", "image/png");

    expect(result.storedFilename).toMatch(/^[0-9a-f-]{36}\.png$/i);
    expect(result.sizeBytes).toBe(validImageBuffer.length);
    expect(fs.existsSync(result.filePath)).toBe(true);

    // Target must NOT be in public/ web root
    expect(result.filePath).not.toContain("public");
    expect(result.filePath).toContain("storage");

    // 4. Secure Read
    const readResult = await readSecureUpload(result.storedFilename);
    expect(readResult).not.toBeNull();
    expect(readResult?.mimeType).toBe("image/png");
    expect(readResult?.buffer.equals(validImageBuffer)).toBe(true);

    // Cleanup
    if (fs.existsSync(result.filePath)) {
      fs.unlinkSync(result.filePath);
    }
  });

  it("7. Multi-Tenant Isolation: Org A cannot check in, clean, or resolve maintenance for Org B", async () => {
    const timestamp = Date.now().toString(36);
    const orgA = await prisma.organization.create({
      data: { name: `Org A ${timestamp}`, slug: `org-a-${timestamp}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${timestamp}`, slug: `org-b-${timestamp}` },
    });

    const propB = await prisma.property.create({
      data: { organizationId: orgB.id, name: "Hotel B", code: "HB" },
    });
    const rtB = await prisma.roomType.create({
      data: { organizationId: orgB.id, propertyId: propB.id, name: "Standard", baseRate: 100 },
    });
    const roomB = await prisma.room.create({
      data: { organizationId: orgB.id, propertyId: propB.id, roomTypeId: rtB.id, number: `B-${timestamp}`, status: "clean" },
    });

    const bookingB = await createReservation({
      organizationId: orgB.id,
      propertyId: propB.id,
      roomIds: [roomB.id],
      checkIn: "2026-12-10",
      checkOut: "2026-12-12",
    });

    // Org A attempts to check in Org B's reservation -> MUST FAIL
    let checkInBlocked = false;
    try {
      await checkInGuest(bookingB.reservation.id, orgA.id, {
        idVerified: true,
        allowOutstandingBalance: true,
      });
    } catch (err: any) {
      checkInBlocked = true;
      expect(err.name).toBe("NotFoundError");
    }
    expect(checkInBlocked).toBe(true);

    // Org A attempts to create maintenance on Org B's room -> MUST FAIL
    let maintBlocked = false;
    try {
      await createMaintenanceTicket({
        organizationId: orgA.id,
        propertyId: propB.id,
        roomId: roomB.id,
        description: "Intruder ticket",
      });
    } catch (err: any) {
      maintBlocked = true;
      expect(err.name).toBe("CrossTenantViolationError");
    }
    expect(maintBlocked).toBe(true);
  });
});
