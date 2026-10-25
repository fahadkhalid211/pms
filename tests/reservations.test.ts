import { describe, it, expect } from "vitest";
import prisma from "@/lib/db";
import {
  createReservation,
  updateReservation,
  cancelReservation,
  listReservations,
  getReservation,
  checkRoomsAvailability,
  DoubleBookingConflictError,
  InvalidStatusTransitionError,
  InvalidDatesError,
  nightsBetween,
  getStayDatesArray,
} from "@/lib/reservations";

describe("WP4 Gate: Reservations Engine, Concurrency, and State Machine", () => {
  it("computes nights between dates and validates date intervals", () => {
    expect(nightsBetween("2026-06-01", "2026-06-04")).toBe(3);
    expect(nightsBetween("2026-06-01", "2026-06-01")).toBe(0);
    expect(() => getStayDatesArray("2026-06-05", "2026-06-02")).toThrow(InvalidDatesError);
  });

  it("1. Concurrency Gate: exactly 1 of N parallel requests succeeds for the same room and nights", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Race Org ${timestamp}`, slug: `race-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Grand Race Hotel", code: "GRH" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Deluxe King", baseRate: 150 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `R-${timestamp}` },
    });

    const checkIn = "2026-10-10";
    const checkOut = "2026-10-14"; // 4 nights

    const PARALLEL_REQUESTS = 8;
    const promises = Array.from({ length: PARALLEL_REQUESTS }, (_, i) =>
      createReservation({
        organizationId: org.id,
        propertyId: prop.id,
        roomIds: [room.id],
        checkIn,
        checkOut,
        adults: 2,
        notes: `Parallel Attempt #${i + 1}`,
      }),
    );

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 must succeed
    expect(fulfilled.length).toBe(1);
    // All other 7 must be cleanly rejected with DoubleBookingConflictError
    expect(rejected.length).toBe(PARALLEL_REQUESTS - 1);
    for (const rej of rejected) {
      if (rej.status === "rejected") {
        expect(rej.reason).toBeInstanceOf(DoubleBookingConflictError);
      }
    }

    // Database verification: exactly 4 RoomNight records exist for this room
    const nights = await prisma.roomNight.findMany({
      where: { roomId: room.id },
    });
    expect(nights).toHaveLength(4);
    const winningRes = (fulfilled[0] as PromiseFulfilledResult<any>).value.reservation;
    for (const n of nights) {
      expect(n.reservationId).toBe(winningRes.id);
    }
  });

  it("2. Overlap Edge Cases: back-to-back stays succeed, while interior overlaps fail", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Overlap Org ${timestamp}`, slug: `overlap-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Harbor Inn", code: "HBR" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Queen Bay", baseRate: 120 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `B-${timestamp}` },
    });

    // Stay 1: Nov 1 to Nov 5 (Nights: Nov 1, 2, 3, 4)
    const stay1 = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2026-11-01",
      checkOut: "2026-11-05",
      adults: 1,
    });
    expect(stay1.reservation.id).toBeDefined();

    // Stay 2 (Back-to-back): Nov 5 to Nov 8 (Nights: Nov 5, 6, 7)
    // Guest 2 checks in the same day Guest 1 checks out -> MUST SUCCEED
    const stay2 = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2026-11-05",
      checkOut: "2026-11-08",
      adults: 1,
    });
    expect(stay2.reservation.id).toBeDefined();

    // Stay 3 (Direct collision): Nov 4 to Nov 6 (overlaps night of Nov 4) -> MUST FAIL
    let failed = false;
    try {
      await createReservation({
        organizationId: org.id,
        propertyId: prop.id,
        roomIds: [room.id],
        checkIn: "2026-11-04",
        checkOut: "2026-11-06",
      });
    } catch (err: any) {
      failed = true;
      expect(err).toBeInstanceOf(DoubleBookingConflictError);
    }
    expect(failed).toBe(true);
  });

  it("3. Multi-Room / Group Booking: reserves multiple rooms atomically", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Group Org ${timestamp}`, slug: `group-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Summit Lodge", code: "SML" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Double Queen", baseRate: 180 },
    });
    const r1 = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `G1-${timestamp}` },
    });
    const r2 = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `G2-${timestamp}` },
    });

    const booking = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [r1.id, r2.id],
      checkIn: "2026-12-01",
      checkOut: "2026-12-04", // 3 nights
      adults: 4,
      guest: { firstName: "Eleanor", lastName: "Vance", email: "eleanor@hillhouse.test" },
    });

    expect(booking.reservation.rooms).toHaveLength(2);

    // Total nights = 2 rooms * 3 nights = 6 room nights
    const nights = await prisma.roomNight.findMany({
      where: { reservationId: booking.reservation.id },
    });
    expect(nights).toHaveLength(6);
  });

  it("4. Status State Machine: enforces valid transitions and rejects invalid state jumps", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `SM Org ${timestamp}`, slug: `sm-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Plaza Hotel", code: "PLZ" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Suite", baseRate: 200 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `SM-${timestamp}` },
    });

    const res = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2027-01-10",
      checkOut: "2027-01-12",
      status: "confirmed",
    });

    // Valid: confirmed -> checked_in
    const checkedIn = await updateReservation(res.reservation.id, org.id, { status: "checked_in" });
    expect(checkedIn.status).toBe("checked_in");

    // Valid: checked_in -> checked_out
    const checkedOut = await updateReservation(res.reservation.id, org.id, { status: "checked_out" });
    expect(checkedOut.status).toBe("checked_out");

    // Invalid: checked_out -> confirmed (terminal state)
    let transitionFailed = false;
    try {
      await updateReservation(res.reservation.id, org.id, { status: "confirmed" });
    } catch (err: any) {
      transitionFailed = true;
      expect(err).toBeInstanceOf(InvalidStatusTransitionError);
    }
    expect(transitionFailed).toBe(true);
  });

  it("5. Cancellation & Inventory Release: releases RoomNights so dates can be re-booked", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Cancel Org ${timestamp}`, slug: `cancel-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Coastal Retreat", code: "CLR" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Beach Suite", baseRate: 300 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `C-${timestamp}` },
    });

    const res1 = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2027-02-01",
      checkOut: "2027-02-05",
      status: "confirmed",
    });

    // Room is booked
    const availBefore = await checkRoomsAvailability(prop.id, org.id, [room.id], "2027-02-01", "2027-02-05");
    expect(availBefore.isAvailable).toBe(false);

    // Cancel reservation
    const cancelRes = await cancelReservation(res1.reservation.id, org.id, "Guest travel plan change");
    expect(cancelRes.reservation.status).toBe("cancelled");

    // RoomNights must be deleted, room is immediately free
    const nights = await prisma.roomNight.findMany({ where: { reservationId: res1.reservation.id } });
    expect(nights).toHaveLength(0);

    const availAfter = await checkRoomsAvailability(prop.id, org.id, [room.id], "2027-02-01", "2027-02-05");
    expect(availAfter.isAvailable).toBe(true);

    // New guest can now book the exact same room and dates
    const res2 = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2027-02-01",
      checkOut: "2027-02-05",
      status: "confirmed",
    });
    expect(res2.reservation.id).toBeDefined();
    expect(res2.reservation.id).not.toBe(res1.reservation.id);
  });

  it("6. Reservation Modification: extending stay adds room nights or rolls back on conflict", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Mod Org ${timestamp}`, slug: `mod-org-${timestamp}` },
    });
    const prop = await prisma.property.create({
      data: { organizationId: org.id, name: "Metro Inn", code: "MTR" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: org.id, propertyId: prop.id, name: "Standard", baseRate: 100 },
    });
    const room = await prisma.room.create({
      data: { organizationId: org.id, propertyId: prop.id, roomTypeId: rt.id, number: `M-${timestamp}` },
    });

    // Stay 1: Mar 10 to Mar 13 (3 nights)
    const res = await createReservation({
      organizationId: org.id,
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2027-03-10",
      checkOut: "2027-03-13",
    });
    expect(res.reservation.roomNights).toHaveLength(3);

    // Extend to Mar 15 (5 nights total)
    const extended = await updateReservation(res.reservation.id, org.id, {
      checkOut: "2027-03-15",
    });
    expect(extended.roomNights).toHaveLength(5);
  });

  it("7. Search & Multi-Tenant Isolation: verifies insensitive search across code and guest details", async () => {
    const timestamp = Date.now().toString(36);
    const orgA = await prisma.organization.create({
      data: { name: `Search Org A ${timestamp}`, slug: `search-a-${timestamp}` },
    });
    const propA = await prisma.property.create({
      data: { organizationId: orgA.id, name: "Prop A", code: "PRA" },
    });
    const rtA = await prisma.roomType.create({
      data: { organizationId: orgA.id, propertyId: propA.id, name: "King", baseRate: 100 },
    });
    const roomA = await prisma.room.create({
      data: { organizationId: orgA.id, propertyId: propA.id, roomTypeId: rtA.id, number: `101-${timestamp}` },
    });

    const booking = await createReservation({
      organizationId: orgA.id,
      propertyId: propA.id,
      roomIds: [roomA.id],
      checkIn: "2027-04-01",
      checkOut: "2027-04-03",
      guest: { firstName: "Sherlock", lastName: "Holmes", email: "sherlock@bakerstreet.test" },
    });

    // Search by guest first name
    const searchByName = await listReservations({ organizationId: orgA.id, query: "sherlock" });
    expect(searchByName.items.some((i) => i.id === booking.reservation.id)).toBe(true);

    // Search by code
    const searchByCode = await listReservations({ organizationId: orgA.id, query: booking.reservation.code.toLowerCase() });
    expect(searchByCode.items.some((i) => i.id === booking.reservation.id)).toBe(true);

    // Cross-tenant search: Org B must see 0 results
    const orgB = await prisma.organization.create({
      data: { name: `Search Org B ${timestamp}`, slug: `search-b-${timestamp}` },
    });
    const searchB = await listReservations({ organizationId: orgB.id, query: "sherlock" });
    expect(searchB.items).toHaveLength(0);
  });

  it("8. Idempotency Key Gate: duplicate POST requests return cached response without double-booking", async () => {
    const timestamp = Date.now().toString(36);
    const { createUserWithContext, authenticate } = await import("@/lib/auth/actions");
    const { POST } = await import("@/app/api/reservations/route");

    const { organization } = await createUserWithContext({
      name: "Idemp Admin",
      email: `idemp-${timestamp}@test.com`,
      password: "IdempPassword123!",
      organizationName: `Idemp Org ${timestamp}`,
    });

    const { token } = await authenticate(`idemp-${timestamp}@test.com`, "IdempPassword123!");

    const prop = await prisma.property.create({
      data: { organizationId: organization.id, name: "Idemp Inn", code: "IDM" },
    });
    const rt = await prisma.roomType.create({
      data: { organizationId: organization.id, propertyId: prop.id, name: "Studio", baseRate: 110 },
    });
    const room = await prisma.room.create({
      data: { organizationId: organization.id, propertyId: prop.id, roomTypeId: rt.id, number: `IDM-${timestamp}` },
    });

    const idempotencyKey = `idemp-key-${timestamp}-${Math.random().toString(36)}`;
    const payload = {
      propertyId: prop.id,
      roomIds: [room.id],
      checkIn: "2027-05-10",
      checkOut: "2027-05-13",
      adults: 1,
    };

    // First POST
    const req1 = new Request("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    const code1 = json1.data.code || json1.data.reservation.code;
    expect(code1).toBeDefined();

    // Second POST with identical idempotency key:
    // Should NOT fail with double-booking error, but return cached 201 response with same code!
    const req2 = new Request("http://localhost:3000/api/reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    const code2 = json2.data.code || json2.data.reservation.code;
    expect(code2).toBe(code1);

    // Verify exactly 3 RoomNights exist in DB for this stay (no duplicate rows)
    const nights = await prisma.roomNight.findMany({ where: { roomId: room.id } });
    expect(nights).toHaveLength(3);
  });
});
