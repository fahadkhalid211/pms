import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createKnowledgeBaseDocument, searchKnowledgeBase, chunkText } from "@/lib/kb";
import {
  searchAvailableRooms,
  createPublicBooking,
  verifyAndGetBooking,
  submitOnlineCheckIn,
  submitCancellationRequest,
  sendGuestPortalMessage,
  getCustomerBookings,
} from "@/lib/portal";
import { respondToGuest } from "@/lib/chatbot";

describe("WP9 Gate: Customer Portal, Anti-IDOR Identity Verification, FTS KB & Chatbot", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let propertyA: { id: string };
  let propertyB: { id: string };
  let roomTypeA: { id: string };
  let roomA1: { id: string; number: string };
  let roomA2: { id: string; number: string };

  let guestA: { id: string; email: string };
  let guestB: { id: string; email: string };
  let reservationA: { id: string; code: string };

  beforeAll(async () => {
    const timestamp = Date.now().toString(36);

    // 1. Setup Tenant Org A
    orgA = await prisma.organization.create({
      data: { name: `WP9 Portal Org A ${timestamp}`, slug: `wp9-org-a-${timestamp}` },
    });

    propertyA = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: "Lumina Grand Coastal",
        code: `LGC-${timestamp}`,
        currency: "USD",
        taxRate: new Prisma.Decimal("12.00"),
        cleaningFee: new Prisma.Decimal("60.00"),
        checkInTime: 15,
        checkOutTime: 11,
      },
    });

    roomTypeA = await prisma.roomType.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        name: "Ocean View Deluxe",
        baseRate: new Prisma.Decimal("220.00"),
        capacity: 3,
      },
    });

    roomA1 = await prisma.room.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        roomTypeId: roomTypeA.id,
        number: `201-${timestamp}`,
        floor: "2",
        status: "available",
      },
    });

    roomA2 = await prisma.room.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        roomTypeId: roomTypeA.id,
        number: `202-${timestamp}`,
        floor: "2",
        status: "available",
      },
    });

    // Setup Mock AI Provider for Org A
    await prisma.aiProviderConfig.create({
      data: {
        organizationId: orgA.id,
        name: "Org A Mock Provider",
        provider: "mock",
        model: "mock-operations-v1",
        isEnabled: true,
        isDefault: true,
      },
    });

    // 2. Setup Tenant Org B (for multi-tenant isolation verification)
    orgB = await prisma.organization.create({
      data: { name: `WP9 Portal Org B ${timestamp}`, slug: `wp9-org-b-${timestamp}` },
    });

    propertyB = await prisma.property.create({
      data: {
        organizationId: orgB.id,
        name: "Lumina Mountain Lodge",
        code: `LML-${timestamp}`,
        currency: "EUR",
        taxRate: new Prisma.Decimal("8.00"),
        cleaningFee: new Prisma.Decimal("40.00"),
      },
    });

    // 3. Setup Guests
    const gA = await prisma.guest.create({
      data: {
        organizationId: orgA.id,
        firstName: "Alice",
        lastName: "Guest",
        email: `alice.guest.${timestamp}@example.com`,
        phone: "+15551234567",
      },
    });
    guestA = { id: gA.id, email: gA.email! };

    const gB = await prisma.guest.create({
      data: {
        organizationId: orgA.id,
        firstName: "Bob",
        lastName: "Attacker",
        email: `bob.attacker.${timestamp}@example.com`,
        phone: "+15559876543",
      },
    });
    guestB = { id: gB.id, email: gB.email! };

    // 4. Create an existing reservation for Guest A in Org A
    const checkInDate = new Date("2026-11-10T15:00:00Z");
    const checkOutDate = new Date("2026-11-13T11:00:00Z");

    reservationA = await prisma.reservation.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        guestId: guestA.id,
        code: `BK-${timestamp.toUpperCase()}-A`,
        status: "confirmed",
        source: "direct",
        checkIn: checkInDate,
        checkOut: checkOutDate,
        adults: 2,
        children: 0,
        currency: "USD",
        totalAmount: new Prisma.Decimal("799.20"),
        rooms: {
          create: [{ roomId: roomA1.id, organizationId: orgA.id }],
        },
      },
    });

    // Room nights for roomA1
    await prisma.roomNight.createMany({
      data: [
        {
          organizationId: orgA.id,
          propertyId: propertyA.id,
          reservationId: reservationA.id,
          roomId: roomA1.id,
          date: new Date("2026-11-10T00:00:00Z"),
          price: new Prisma.Decimal("220.00"),
        },
        {
          organizationId: orgA.id,
          propertyId: propertyA.id,
          reservationId: reservationA.id,
          roomId: roomA1.id,
          date: new Date("2026-11-11T00:00:00Z"),
          price: new Prisma.Decimal("220.00"),
        },
        {
          organizationId: orgA.id,
          propertyId: propertyA.id,
          reservationId: reservationA.id,
          roomId: roomA1.id,
          date: new Date("2026-11-12T00:00:00Z"),
          price: new Prisma.Decimal("220.00"),
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    if (orgA?.id) {
      await prisma.organization.delete({ where: { id: orgA.id } }).catch(() => {});
    }
    if (orgB?.id) {
      await prisma.organization.delete({ where: { id: orgB.id } }).catch(() => {});
    }
  });

  // =========================================================================
  // TEST 1: Knowledge Base Document Creation, Chunking & Postgres FTS
  // =========================================================================
  it("indexes knowledge base documents and performs FTS rank retrieval", async () => {
    const doc = await createKnowledgeBaseDocument({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      type: "policy",
      title: "Cancellation and Refund Policies",
      content: `Our hotel provides transparent cancellation terms for all direct bookings.
Guests may cancel their stay free of penalty up to 48 hours prior to official check-in time.
Late cancellations within 24 hours of arrival incur a standard fee equal to one full night room rate.
All refunds are credited to the original payment method within five business days.

Check-in commences at 15:00 and check-out is required by 11:00 AM.
Late check-out may be granted subject to availability for a nominal charge.`,
    });

    expect(doc).toBeDefined();
    expect(doc.id).toBeDefined();
    expect(doc.chunksCount).toBeGreaterThanOrEqual(1);

    // Search for relevant terms
    const searchResults = await searchKnowledgeBase(orgA.id, "cancellation refund fee policy");
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0].documentId).toBe(doc.id);
    expect(searchResults[0].content).toContain("cancellation");
    expect(searchResults[0].score).toBeGreaterThan(0);
  });

  // =========================================================================
  // TEST 2: Multi-Tenant Knowledge Base Isolation
  // =========================================================================
  it("enforces strict multi-tenant isolation on knowledge base retrieval", async () => {
    // Org B queries for the exact phrase indexed in Org A
    const resultsOrgB = await searchKnowledgeBase(orgB.id, "cancellation refund fee policy");
    expect(resultsOrgB.length).toBe(0);

    // Adding a document to Org B should not leak into Org A
    await createKnowledgeBaseDocument({
      organizationId: orgB.id,
      propertyId: propertyB.id,
      type: "amenity_guide",
      title: "Alpine Ski Equipment Rental",
      content: "Complimentary heated ski lockers and premium downhill equipment rentals available for all guests.",
    });

    const resultsOrgA = await searchKnowledgeBase(orgA.id, "Alpine Ski Equipment Rental");
    expect(resultsOrgA.length).toBe(0);
  });

  // =========================================================================
  // TEST 3: Strict Anti-IDOR Identity Verification Gate (Ref alone DENIED)
  // =========================================================================
  it("strictly denies reservation lookups with booking reference alone (Anti-IDOR)", async () => {
    // 1. Without email
    await expect(
      verifyAndGetBooking({
        organizationId: orgA.id,
        bookingCode: reservationA.code,
      }),
    ).rejects.toThrow("Identity verification failed: Booking reference alone is denied.");

    // 2. With empty email string
    await expect(
      verifyAndGetBooking({
        organizationId: orgA.id,
        bookingCode: reservationA.code,
        email: "   ",
      }),
    ).rejects.toThrow("Identity verification failed: Booking reference alone is denied.");

    // 3. With incorrect email
    await expect(
      verifyAndGetBooking({
        organizationId: orgA.id,
        bookingCode: reservationA.code,
        email: "wrong.email@example.com",
      }),
    ).rejects.toThrow("Verification failed: No booking matching reference and email address found.");
  });

  // =========================================================================
  // TEST 4: Identity Verification Gate - Valid Reference + Matching Email
  // =========================================================================
  it("successfully retrieves verified booking when reference and email match", async () => {
    const verified = await verifyAndGetBooking({
      organizationId: orgA.id,
      bookingCode: reservationA.code,
      email: guestA.email,
    });

    expect(verified.id).toBe(reservationA.id);
    expect(verified.code).toBe(reservationA.code);
    expect(verified.guest?.email).toBe(guestA.email);
    expect(verified.property?.name).toBe("Lumina Grand Coastal");
    expect(verified.rooms[0]?.room?.number).toBe(roomA1.number);
    expect(Number(verified.totalAmount)).toBe(799.2);
  });

  // =========================================================================
  // TEST 5: Cross-Customer Isolation Gate
  // =========================================================================
  it("blocks cross-customer booking access (Customer B email + Customer A ref)", async () => {
    await expect(
      verifyAndGetBooking({
        organizationId: orgA.id,
        bookingCode: reservationA.code,
        email: guestB.email, // Bob trying to access Alice's reservation
      }),
    ).rejects.toThrow("Verification failed: No booking matching reference and email address found.");
  });

  // =========================================================================
  // TEST 6: Public Availability Search & Live Pricing Quotes
  // =========================================================================
  it("calculates public room availability and live financial quotes", async () => {
    // Query dates overlapping with reservationA on roomA1 (2026-11-10 to 2026-11-13)
    const quotes = await searchAvailableRooms({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      checkIn: "2026-11-10",
      checkOut: "2026-11-13",
      adults: 2,
    });

    expect(quotes.length).toBe(1);
    const quote = quotes[0];
    expect(quote.roomTypeName).toBe("Ocean View Deluxe");
    // roomA1 is booked for these dates, so availableRoomCount should be 1 (only roomA2)
    expect(quote.availableRoomCount).toBe(1);

    // Verify financial quote decimal accuracy
    expect(quote.priceQuote.nights).toBe(3);
    // Base: 220 * 3 = 660.00
    expect(quote.priceQuote.basePrice).toBe("660.00");
    // Fees: 60.00 cleaning fee
    expect(quote.priceQuote.fees).toBe("60.00");
    // Taxes: 12% of (660 + 60) = 86.40
    expect(quote.priceQuote.taxes).toBe("86.40");
    // Grand Total: 660 + 60 + 86.40 = 806.40
    expect(quote.priceQuote.total).toBe("806.40");
  });

  // =========================================================================
  // TEST 7: Public Booking Creation & RoomNight Atomicity
  // =========================================================================
  it("allows public guest to book an available room atomically with RoomNight records", async () => {
    const booking = await createPublicBooking({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      roomTypeId: roomTypeA.id,
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 2,
      guest: {
        firstName: "Claire",
        lastName: "Voyant",
        email: `claire.${Date.now()}@example.com`,
        phone: "+15554443322",
      },
      notes: "Arriving by train late afternoon",
    });

    expect(booking.bookingCode).toBeDefined();
    expect(booking.roomNumber).toBe(roomA2.number); // roomA1 was booked, assigned roomA2
    expect(booking.reservation.source).toBe("public_portal");

    // Verify atomic RoomNight creation
    const nights = await prisma.roomNight.findMany({
      where: { reservationId: booking.reservation.id },
      orderBy: { date: "asc" },
    });
    expect(nights.length).toBe(2);
    expect(nights[0].roomId).toBe(roomA2.id);

    // Verify search now reflects 0 available rooms for roomTypeA on those dates
    const updatedQuotes = await searchAvailableRooms({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      adults: 2,
    });
    expect(updatedQuotes.length).toBe(0); // Both rooms are now booked!
  });

  // =========================================================================
  // TEST 8: Online Check-In Submission
  // =========================================================================
  it("submits online check-in with arrival ETA and guest preferences", async () => {
    const checkInResult = await submitOnlineCheckIn({
      organizationId: orgA.id,
      bookingCode: reservationA.code,
      email: guestA.email,
      estimatedArrival: "16:30",
      idVerifiedAck: true,
      emergencyContact: "John Guest (+15550001111)",
      specialRequests: "High floor quiet room please",
      preferences: { featherPillow: true, extraTowels: true },
    });

    expect(checkInResult.ok).toBe(true);
    expect(checkInResult.bookingCode).toBe(reservationA.code);

    // Verify guest request record was created
    const req = await prisma.guestRequest.findFirst({
      where: {
        organizationId: orgA.id,
        reservationId: reservationA.id,
        type: "online_checkin",
      },
    });

    expect(req).toBeDefined();
    expect(req?.status).toBe("completed");
    const parsedContent = JSON.parse(req!.content);
    expect(parsedContent.estimatedArrival).toBe("16:30");
    expect(parsedContent.emergencyContact).toContain("John Guest");
  });

  // =========================================================================
  // TEST 9: Guest Cancellation Request
  // =========================================================================
  it("submits cancellation request and computes fee preview", async () => {
    const cancelResult = await submitCancellationRequest({
      organizationId: orgA.id,
      bookingCode: reservationA.code,
      email: guestA.email,
      reason: "Flight cancelled due to storm",
    });

    expect(cancelResult.ok).toBe(true);
    expect(cancelResult.bookingCode).toBe(reservationA.code);
    expect(cancelResult.feeEstimate).toBeDefined();

    // Verify cancellation request recorded
    const req = await prisma.guestRequest.findFirst({
      where: {
        organizationId: orgA.id,
        reservationId: reservationA.id,
        type: "cancellation_request",
      },
    });
    expect(req).toBeDefined();
    expect(req?.status).toBe("pending");
    const content = JSON.parse(req!.content);
    expect(content.reason).toContain("Flight cancelled");
  });

  // =========================================================================
  // TEST 10: Guest Front Desk Messaging & Customer Bookings List
  // =========================================================================
  it("supports guest messaging and retrieves customer bookings", async () => {
    const messageRes = await sendGuestPortalMessage({
      organizationId: orgA.id,
      bookingCode: reservationA.code,
      email: guestA.email,
      message: "Could we request an airport shuttle upon arrival?",
    });

    expect(messageRes.ok).toBe(true);
    expect(messageRes.requestId).toBeDefined();

    // Customer Bookings List
    const customerBookings = await getCustomerBookings(orgA.id, guestA.email);
    expect(customerBookings.length).toBeGreaterThanOrEqual(1);
    expect(customerBookings[0].code).toBe(reservationA.code);
    expect(customerBookings[0].propertyName).toBe("Lumina Grand Coastal");
  });

  // =========================================================================
  // TEST 11: Chatbot Grounded Response & Operating Hours
  // =========================================================================
  it("provides grounded chatbot answers adhering to hotel operating hours without emojis", async () => {
    const response = await respondToGuest({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      message: "What time is check-in and check-out at the hotel?",
    });

    expect(response.reply).toBeDefined();
    expect(response.sessionKey).toBeDefined();
    expect(response.status).toBe("active");
    // Ensure no emojis are returned in response
    const emojiRegex = /\p{Extended_Pictographic}/u;
    expect(emojiRegex.test(response.reply)).toBe(false);
  });

  // =========================================================================
  // TEST 12: Chatbot Anti-IDOR Identity Verification Gate
  // =========================================================================
  it("enforces identity verification when chatbot is queried for booking details", async () => {
    // 1. Ref alone: prompt should decline and request email
    const promptRefOnly = await respondToGuest({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      message: `Please check reservation ${reservationA.code}`,
    });

    expect(promptRefOnly.toolUsed).toBe("lookup_verified_booking");
    expect(promptRefOnly.reply).toContain("Identity verification required");
    expect(promptRefOnly.reply.toLowerCase()).toContain("email");

    // 2. Ref + matching email: reveals verified booking details
    const promptVerified = await respondToGuest({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      message: `Please check booking reference ${reservationA.code} with email ${guestA.email}`,
    });

    expect(promptVerified.toolUsed).toBe("lookup_verified_booking");
    expect(promptVerified.reply).toContain(reservationA.code);
    expect(promptVerified.reply).toContain("Alice Guest");
    expect(promptVerified.reply).toContain(roomA1.number);
  });

  // =========================================================================
  // TEST 13: Chatbot Human Handoff Escalation
  // =========================================================================
  it("triggers human handoff and flags session as needs_human upon escalation request", async () => {
    const sessionKey = `guest-escalate-${Date.now().toString(36)}`;

    const handoffResponse = await respondToGuest({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      sessionKey,
      message: "There is an urgent plumbing emergency, I need to speak to a manager right now!",
    });

    expect(handoffResponse.handoff).toBe(true);
    expect(handoffResponse.status).toBe("needs_human");
    expect(handoffResponse.toolUsed).toBe("request_human_handoff");

    // Verify conversation record in database has status 'needs_human'
    const conversation = await prisma.chatbotConversation.findUnique({
      where: { sessionKey },
    });
    expect(conversation).toBeDefined();
    expect(conversation?.status).toBe("needs_human");
  });
});
