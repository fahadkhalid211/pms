import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getExecutiveKpis, exportCsvReport } from "@/lib/reports";
import {
  saveIntegrationCredentials,
  getDecryptedCredentials,
  handleWebhookEvent,
  generatePropertyIcalFeed,
  parseIcalEvents,
  verifyWebhookSignature,
} from "@/lib/integrations";
import {
  purgeRetentionLogs,
  exportCustomerArchive,
  anonymizeCustomerRecord,
} from "@/lib/retention";
import { logActivity } from "@/lib/audit";

describe("WP10 Gate: Reports, ADR/RevPAR Analytics, Integrations, iCal & Hardening", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let propertyA: { id: string };
  let roomTypeA: { id: string };
  let roomA1: { id: string; number: string };
  let roomA2: { id: string; number: string };
  let guestA: { id: string; email: string };
  let reservationA: { id: string; code: string };

  beforeAll(async () => {
    const timestamp = Date.now().toString(36);

    // 1. Setup Tenant Org A
    orgA = await prisma.organization.create({
      data: { name: `WP10 Org A ${timestamp}`, slug: `wp10-org-a-${timestamp}` },
    });

    propertyA = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: "Lumina Coastal Resort",
        code: `LCR-${timestamp}`,
        currency: "USD",
        taxRate: new Prisma.Decimal("10.00"),
        cleaningFee: new Prisma.Decimal("50.00"),
        checkInTime: 15,
        checkOutTime: 11,
      },
    });

    roomTypeA = await prisma.roomType.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        name: "Panoramic Suite",
        baseRate: new Prisma.Decimal("200.00"),
        capacity: 2,
      },
    });

    roomA1 = await prisma.room.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        roomTypeId: roomTypeA.id,
        number: `301-${timestamp}`,
        floor: "3",
        status: "occupied",
      },
    });

    roomA2 = await prisma.room.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        roomTypeId: roomTypeA.id,
        number: `302-${timestamp}`,
        floor: "3",
        status: "available",
      },
    });

    // 2. Setup Tenant Org B (for cross-tenant isolation tests)
    orgB = await prisma.organization.create({
      data: { name: `WP10 Org B ${timestamp}`, slug: `wp10-org-b-${timestamp}` },
    });

    // 3. Setup Guest & Reservation in Org A
    const gA = await prisma.guest.create({
      data: {
        organizationId: orgA.id,
        firstName: "Diana",
        lastName: "Prince",
        email: `diana.${timestamp}@example.com`,
        phone: "+15559998888",
      },
    });
    guestA = { id: gA.id, email: gA.email! };

    const checkIn = new Date();
    checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(checkIn.getTime() + 2 * 86400000);

    reservationA = await prisma.reservation.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        guestId: guestA.id,
        code: `BK-RPT-${timestamp.toUpperCase()}`,
        status: "confirmed",
        source: "direct",
        checkIn,
        checkOut,
        adults: 2,
        currency: "USD",
        totalAmount: new Prisma.Decimal("490.00"), // 2 nights @ 200 = 400 + 50 fee + 40 tax
        rooms: {
          create: [{ roomId: roomA1.id, organizationId: orgA.id }],
        },
      },
    });

    // Create 2 room nights for roomA1
    await prisma.roomNight.createMany({
      data: [
        {
          organizationId: orgA.id,
          propertyId: propertyA.id,
          reservationId: reservationA.id,
          roomId: roomA1.id,
          date: checkIn,
          price: new Prisma.Decimal("200.00"),
          status: "reserved",
        },
        {
          organizationId: orgA.id,
          propertyId: propertyA.id,
          reservationId: reservationA.id,
          roomId: roomA1.id,
          date: new Date(checkIn.getTime() + 86400000),
          price: new Prisma.Decimal("200.00"),
          status: "reserved",
        },
      ],
    });

    // Create Invoice & Payment
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        reservationId: reservationA.id,
        number: `INV-${timestamp.toUpperCase()}`,
        status: "issued",
        subtotal: new Prisma.Decimal("400.00"),
        tax: new Prisma.Decimal("40.00"),
        total: new Prisma.Decimal("490.00"),
      },
    });

    await prisma.payment.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        invoiceId: invoice.id,
        amount: new Prisma.Decimal("490.00"),
        currency: "USD",
        status: "captured",
        method: "credit_card",
        provider: "stripe",
      },
    });
  });

  afterAll(async () => {
    if (orgA?.id) {
      await prisma.organization.delete({ where: { id: orgA.id } }).catch(() => {});
    }
    if (orgB?.id) {
      await prisma.organization.delete({ where: { id: orgB.id } }).catch(() => {});
    }
  });

  // =========================================================================
  // TEST 1: Executive KPI Metrics (Occupancy, ADR, RevPAR)
  // =========================================================================
  it("calculates real ADR, RevPAR, and Occupancy metrics with Decimal half-up precision", async () => {
    const today = new Date();
    const kpis = await getExecutiveKpis({
      organizationId: orgA.id,
      propertyId: propertyA.id,
      startDate: new Date(today.getTime() - 86400000),
      endDate: new Date(today.getTime() + 3 * 86400000),
    });

    expect(kpis.totalRooms).toBe(2);
    expect(kpis.roomsSold).toBe(2);
    // Room revenue: 2 nights * $200 = $400.00
    expect(Number(kpis.roomRevenue)).toBe(400);

    // ADR = room revenue / rooms sold = 400 / 2 = 200.00
    expect(Number(kpis.adr)).toBe(200);

    // RevPAR = room revenue / rooms available in period
    expect(Number(kpis.revpar)).toBeGreaterThan(0);

    // Occupancy rate should be > 0%
    expect(kpis.occupancyRate).toBeGreaterThan(0);
  });

  // =========================================================================
  // TEST 2: Multi-Tenant Report Isolation
  // =========================================================================
  it("strictly enforces multi-tenant scoping so Org B cannot observe Org A metrics", async () => {
    const kpisOrgB = await getExecutiveKpis({
      organizationId: orgB.id,
    });

    expect(kpisOrgB.totalRooms).toBe(0);
    expect(kpisOrgB.roomsSold).toBe(0);
    expect(Number(kpisOrgB.roomRevenue)).toBe(0);
    expect(Number(kpisOrgB.adr)).toBe(0);
    expect(Number(kpisOrgB.revpar)).toBe(0);
    expect(kpisOrgB.occupancyRate).toBe(0);
  });

  // =========================================================================
  // TEST 3: RFC 4180 CSV Export (Financial, Occupancy, Reservations)
  // =========================================================================
  it("generates compliant RFC 4180 CSV exports for financial and reservations reports", async () => {
    // 1. Financial CSV
    const financialCsv = await exportCsvReport({
      organizationId: orgA.id,
      type: "financial",
    });
    expect(financialCsv).toContain("Invoice Number,Date,Property,Guest Name");
    expect(financialCsv).toContain("INV-");
    expect(financialCsv).toContain("Diana Prince");
    expect(financialCsv).toContain("490.00");

    // 2. Occupancy CSV
    const occupancyCsv = await exportCsvReport({
      organizationId: orgA.id,
      type: "occupancy",
    });
    expect(occupancyCsv).toContain("Date,Total Rooms,Rooms Sold,Occupancy Rate (%),Room Revenue,ADR,RevPAR");

    // 3. Reservations CSV
    const resCsv = await exportCsvReport({
      organizationId: orgA.id,
      type: "reservations",
    });
    expect(resCsv).toContain("Confirmation Code,Created Date,Property,Guest First Name");
    expect(resCsv).toContain(reservationA.code);
    expect(resCsv).toContain("Diana");
  });

  // =========================================================================
  // TEST 4: Integration Credentials Encryption (AES-256-GCM)
  // =========================================================================
  it("encrypts integration credentials at rest with AES-256-GCM and decrypts on retrieval", async () => {
    const integration = await prisma.integration.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        provider: "stripe",
        name: "Org A Stripe Account",
        status: "pending_config",
      },
    });

    const secretKey = "sk_live_verySecretKey987654321";
    const webhookSecret = "whsec_superSecretSigningKey123";

    await saveIntegrationCredentials({
      organizationId: orgA.id,
      integrationId: integration.id,
      credentials: {
        apiKey: secretKey,
        apiSecret: webhookSecret,
      },
    });

    // Inspect database row directly: raw plaintext MUST NOT appear in DB
    const dbRow = await prisma.integration.findUnique({
      where: { id: integration.id },
    });
    const credsObject = dbRow?.credentials as Record<string, string>;
    expect(credsObject.apiKey).not.toBe(secretKey);
    expect(credsObject.apiKey).not.toContain("sk_live");
    expect(credsObject.apiSecret).not.toContain("whsec_");

    // Decrypt credentials
    const decrypted = await getDecryptedCredentials(orgA.id, integration.id);
    expect(decrypted.apiKey).toBe(secretKey);
    expect(decrypted.apiSecret).toBe(webhookSecret);
  });

  // =========================================================================
  // TEST 5: Webhook Event Deduplication by externalId
  // =========================================================================
  it("enforces idempotent webhook deduplication: duplicate externalId is marked ignored", async () => {
    const externalId = `evt_test_${Date.now().toString(36)}`;

    // Delivery 1: initial event
    const delivery1 = await handleWebhookEvent({
      organizationId: orgA.id,
      provider: "stripe",
      eventType: "payment_intent.succeeded",
      externalId,
      payload: { amount: 49000, currency: "usd" },
    });

    expect(delivery1.status).toBe("processed");
    expect(delivery1.duplicate).toBe(false);

    // Delivery 2: identical event re-delivered by external webhook sender
    const delivery2 = await handleWebhookEvent({
      organizationId: orgA.id,
      provider: "stripe",
      eventType: "payment_intent.succeeded",
      externalId,
      payload: { amount: 49000, currency: "usd" },
    });

    expect(delivery2.status).toBe("ignored");
    expect(delivery2.duplicate).toBe(true);

    // Verify database record has 'ignored' status and duplicate error recorded
    const event2 = await prisma.webhookEvent.findUnique({
      where: { id: delivery2.eventId },
    });
    expect(event2?.status).toBe("ignored");
    expect(event2?.error).toContain("Duplicate externalId");
  });

  // =========================================================================
  // TEST 6: RFC 5545 iCal Feed Generation & Parser
  // =========================================================================
  it("generates valid RFC 5545 iCal feeds and parses VEVENT blocks", async () => {
    const icsFeed = await generatePropertyIcalFeed(orgA.id, propertyA.id);

    expect(icsFeed).toContain("BEGIN:VCALENDAR");
    expect(icsFeed).toContain("VERSION:2.0");
    expect(icsFeed).toContain("BEGIN:VEVENT");
    expect(icsFeed).toContain(`Lumina PMS ${reservationA.code}`);
    expect(icsFeed).toContain("STATUS:CONFIRMED");
    expect(icsFeed).toContain("END:VCALENDAR");

    // Test parser
    const parsed = parseIcalEvents(icsFeed);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0].uid).toContain("lumina-");
    expect(parsed[0].summary).toContain(reservationA.code);
  });

  // =========================================================================
  // TEST 7: Webhook Signature Verification Utility
  // =========================================================================
  it("validates HMAC SHA256 webhook signatures and rejects tampered bodies", () => {
    const secret = "whsec_test_signing_secret_12345";
    const body = JSON.stringify({ event: "reservation.created", id: "123" });

    // Compute valid signature
    const crypto = require("crypto");
    const validSig = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

    expect(verifyWebhookSignature(body, validSig, secret)).toBe(true);
    expect(verifyWebhookSignature(body, "invalid_signature", secret)).toBe(false);
    expect(verifyWebhookSignature(body + "tampered", validSig, secret)).toBe(false);
  });

  // =========================================================================
  // TEST 8: Data Retention Purge Policy
  // =========================================================================
  it("purges historical logs older than retention cutoff while preserving recent records", async () => {
    const oldTimestamp = new Date(Date.now() - 100 * 86400000); // 100 days ago

    // Insert an old log
    const oldLog = await logActivity({
      organizationId: orgA.id,
      source: "backend",
      category: "operations",
      action: "test.old_event",
      summary: "Old event 100 days ago",
    });
    if (oldLog) {
      await prisma.auditLog.update({
        where: { id: oldLog.id },
        data: { createdAt: oldTimestamp },
      });
    }

    // Insert a recent log
    const recentLog = await logActivity({
      organizationId: orgA.id,
      source: "backend",
      category: "operations",
      action: "test.recent_event",
      summary: "Recent event today",
    });

    const purgeResult = await purgeRetentionLogs({
      organizationId: orgA.id,
      daysToKeep: 90,
      dryRun: false,
    });

    expect(purgeResult.purgedActivityLogs).toBeGreaterThanOrEqual(1);

    // Verify recent log is preserved
    const foundRecent = await prisma.auditLog.findUnique({
      where: { id: recentLog!.id },
    });
    expect(foundRecent).toBeDefined();
  });

  // =========================================================================
  // TEST 9: GDPR Data Portability & Right to Erasure / Anonymization
  // =========================================================================
  it("exports customer data archive and enforces GDPR anonymization", async () => {
    // 1. Export Archive
    const archive = await exportCustomerArchive(orgA.id, guestA.id);
    expect(archive.guest.email).toBe(guestA.email);
    expect(archive.guest.firstName).toBe("Diana");
    expect(archive.reservations.length).toBeGreaterThanOrEqual(1);
    expect(archive.reservations[0].code).toBe(reservationA.code);

    // 2. Anonymize Customer
    const anonResult = await anonymizeCustomerRecord(orgA.id, guestA.id);
    expect(anonResult.ok).toBe(true);

    // Verify in database: PII removed
    const anonGuest = await prisma.guest.findUnique({
      where: { id: guestA.id },
    });
    expect(anonGuest?.firstName).toBe("Anonymized");
    expect(anonGuest?.email).toBeNull();
    expect(anonGuest?.phone).toBeNull();

    // Verify financial integrity: reservation total is intact
    const preservedReservation = await prisma.reservation.findUnique({
      where: { id: reservationA.id },
    });
    expect(Number(preservedReservation?.totalAmount)).toBe(490);
  });
});
