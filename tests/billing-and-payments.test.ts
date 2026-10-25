import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  generateInvoiceFromReservation,
  recordPayment,
  requestRefund,
  approveRefund,
  getInvoiceFolio,
} from "@/lib/billing";
import {
  StripeGatewayAdapter,
  MockGatewayAdapter,
  generateStripeSignature,
} from "@/lib/payments/gateway";
import {
  NotFoundError,
  CrossTenantViolationError,
  InvoiceAlreadySettledError,
  OverpaymentNotAllowedError,
  RefundExceedsPaymentError,
  WebhookSignatureVerificationError,
} from "@/lib/errors";

describe("WP6 Gate: Billing, Server-Side Invoicing, Payments, Refunds, and Webhooks", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let propertyA: { id: string; currency: string; taxRate: Prisma.Decimal; cleaningFee: Prisma.Decimal };
  let propertyB: { id: string };
  let roomTypeA: { id: string; baseRate: Prisma.Decimal };
  let roomA: { id: string };
  let guestA: { id: string };
  let reservationA: { id: string; code: string; totalAmount: Prisma.Decimal };
  let userAdminA: { id: string };

  beforeAll(async () => {
    // 1. Create Organization A & Property A (with 10% tax and $50 cleaning fee)
    orgA = await prisma.organization.create({
      data: {
        name: "WP6 Billing Org A",
        slug: `wp6-org-a-${Date.now()}`,
      },
    });

    propertyA = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: "Grand Lumina Palace",
        code: "GLP",
        currency: "USD",
        taxRate: new Prisma.Decimal("10.00"), // 10%
        cleaningFee: new Prisma.Decimal("50.00"), // $50 cleaning fee
      },
    });

    userAdminA = await prisma.user.create({
      data: {
        email: `billing-admin-${Date.now()}@lumina.local`,
        passwordHash: "$2a$12$eXampleHashedPasswordForTestOnly999999999999999999999999",
        name: "Billing Admin",
        organizationId: orgA.id,
      },
    });

    // 2. Room Type & Room
    roomTypeA = await prisma.roomType.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        name: "Deluxe Suite",
        baseRate: new Prisma.Decimal("200.00"),
        capacity: 2,
      },
    });

    roomA = await prisma.room.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        roomTypeId: roomTypeA.id,
        number: `601-${Date.now().toString().slice(-4)}`,
        floor: "6",
        status: "clean",
      },
    });

    guestA = await prisma.guest.create({
      data: {
        organizationId: orgA.id,
        firstName: "Alexander",
        lastName: "Hamilton",
        email: `hamilton-${Date.now()}@treasury.gov`,
      },
    });

    // 3. Create a Reservation for 3 nights (2026-11-01 to 2026-11-04)
    const checkIn = new Date("2026-11-01T15:00:00.000Z");
    const checkOut = new Date("2026-11-04T11:00:00.000Z");

    reservationA = await prisma.reservation.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        guestId: guestA.id,
        code: `BK-BILL-${Date.now().toString().slice(-5)}`,
        status: "confirmed",
        checkIn,
        checkOut,
        adults: 2,
        currency: "USD",
        totalAmount: new Prisma.Decimal("715.00"),
      },
    });

    await prisma.reservationRoom.create({
      data: {
        organizationId: orgA.id,
        reservationId: reservationA.id,
        roomId: roomA.id,
        nightlyRate: new Prisma.Decimal("200.00"),
      },
    });

    // Create 3 RoomNights at $200 each = $600
    const stayDates = [
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-02T00:00:00.000Z"),
      new Date("2026-11-03T00:00:00.000Z"),
    ];

    for (const d of stayDates) {
      await prisma.roomNight.create({
        data: {
          organizationId: orgA.id,
          propertyId: propertyA.id,
          roomId: roomA.id,
          reservationId: reservationA.id,
          date: d,
          status: "reserved",
          price: new Prisma.Decimal("200.00"),
        },
      });
    }

    // 4. Create Tenant B for multi-tenant isolation tests
    orgB = await prisma.organization.create({
      data: {
        name: "WP6 Billing Org B",
        slug: `wp6-org-b-${Date.now()}`,
      },
    });

    propertyB = await prisma.property.create({
      data: {
        organizationId: orgB.id,
        name: "Rival Seaside Inn",
        code: "RSI",
      },
    });
  });

  afterAll(async () => {
    const orgIds = [orgA?.id, orgB?.id].filter(Boolean) as string[];
    if (orgIds.length === 0) return;

    // Cleanup in reverse dependency order
    await prisma.roomNight.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.reservationRoom.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.refund.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.payment.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.invoiceLineItem.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.reservation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.room.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.roomType.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.guest.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  });

  // -------------------------------------------------------------------------
  // 1. Server-side Invoice Generation & Decimal Math Gate
  // -------------------------------------------------------------------------
  it("1. Invoice Generation Gate: calculates server-side totals, line items, taxes, and fees without trusting client", async () => {
    const invoice = await generateInvoiceFromReservation(
      { organizationId: orgA.id },
      {
        reservationId: reservationA.id,
        notes: "Automated test folio",
        userId: userAdminA.id,
      },
    );

    expect(invoice.id).toBeDefined();
    expect(invoice.number).toMatch(/^INV-\d{6}-[A-F0-9]{6}$/);
    expect(invoice.status).toBe("issued");
    expect(invoice.organizationId).toBe(orgA.id);
    expect(invoice.reservationId).toBe(reservationA.id);

    // Math Verification:
    // Room Nights: 3 nights @ $200 = $600.00
    // Cleaning Fee: $50.00
    // Subtotal: $650.00
    // Tax (10% of $650.00): $65.00
    // Grand Total: $715.00
    expect(new Prisma.Decimal(invoice.subtotal).toFixed(2)).toBe("650.00");
    expect(new Prisma.Decimal(invoice.tax).toFixed(2)).toBe("65.00");
    expect(new Prisma.Decimal(invoice.total).toFixed(2)).toBe("715.00");

    // Line items verification
    expect(invoice.lineItems.length).toBe(2);
    const roomItem = invoice.lineItems.find((li) => li.description.includes("night(s) stay"));
    expect(roomItem).toBeDefined();
    expect(roomItem?.quantity).toBe(3);
    expect(new Prisma.Decimal(roomItem!.total).toFixed(2)).toBe("600.00");

    const feeItem = invoice.lineItems.find((li) => li.description.includes("Cleaning Fee"));
    expect(feeItem).toBeDefined();
    expect(new Prisma.Decimal(feeItem!.total).toFixed(2)).toBe("50.00");

    // Idempotency: Calling generate again returns the exact same invoice without creating duplicates
    const invoice2 = await generateInvoiceFromReservation(
      { organizationId: orgA.id },
      { reservationId: reservationA.id },
    );
    expect(invoice2.id).toBe(invoice.id);
    expect(invoice2.number).toBe(invoice.number);
  });

  // -------------------------------------------------------------------------
  // 2. Deposits & Partial Payments Tracking Gate
  // -------------------------------------------------------------------------
  it("2. Deposits Gate: records partial deposit, transitions status to partially_paid, and reconciles balance", async () => {
    const folios = await prisma.invoice.findMany({
      where: { reservationId: reservationA.id, organizationId: orgA.id },
    });
    const invoiceId = folios[0].id;

    // Record $300.00 partial deposit
    const payment = await recordPayment(
      { organizationId: orgA.id },
      {
        invoiceId,
        amount: "300.00",
        method: "card",
        provider: "manual",
        status: "captured",
        userId: userAdminA.id,
      },
    );

    expect(payment.id).toBeDefined();
    expect(new Prisma.Decimal(payment.amount).toFixed(2)).toBe("300.00");
    expect(payment.status).toBe("captured");

    // Check Folio Reconciliation
    const folio = await getInvoiceFolio({ organizationId: orgA.id }, invoiceId);
    expect(folio.status).toBe("partially_paid");
    expect(folio.summary.total).toBe("715.00");
    expect(folio.summary.totalCaptured).toBe("300.00");
    expect(folio.summary.netPaid).toBe("300.00");
    // $715.00 - $300.00 = $415.00 remaining
    expect(folio.summary.balanceDue).toBe("415.00");
    expect(folio.summary.isFullyPaid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. Reconciled Payment Completion & Overpayment Protection Gate
  // -------------------------------------------------------------------------
  it("3. Payment Reconciled Gate: records remaining balance, transitions to paid, and rejects overpayment", async () => {
    const folios = await prisma.invoice.findMany({
      where: { reservationId: reservationA.id, organizationId: orgA.id },
    });
    const invoiceId = folios[0].id;

    // Overpayment attempt: remaining is $415.00, attempting to pay $500.00 must fail
    await expect(
      recordPayment(
        { organizationId: orgA.id },
        {
          invoiceId,
          amount: "500.00",
          method: "card",
        },
      ),
    ).rejects.toThrow(OverpaymentNotAllowedError);

    // Negative or zero amount must fail
    await expect(
      recordPayment(
        { organizationId: orgA.id },
        {
          invoiceId,
          amount: "0.00",
        },
      ),
    ).rejects.toThrow();

    // Exact remaining payment of $415.00
    const payment2 = await recordPayment(
      { organizationId: orgA.id },
      {
        invoiceId,
        amount: "415.00",
        method: "bank_transfer",
        provider: "manual",
        status: "captured",
        userId: userAdminA.id,
      },
    );

    expect(payment2.status).toBe("captured");

    // Check Folio: Now fully settled and status = 'paid'
    const folio = await getInvoiceFolio({ organizationId: orgA.id }, invoiceId);
    expect(folio.status).toBe("paid");
    expect(folio.summary.netPaid).toBe("715.00");
    expect(folio.summary.balanceDue).toBe("0.00");
    expect(folio.summary.isFullyPaid).toBe(true);

    // Additional payment on fully settled invoice must fail
    await expect(
      recordPayment(
        { organizationId: orgA.id },
        {
          invoiceId,
          amount: "10.00",
        },
      ),
    ).rejects.toThrow(InvoiceAlreadySettledError);
  });

  // -------------------------------------------------------------------------
  // 4. Refunds Workflow & Manager Approval Lifecycle Gate
  // -------------------------------------------------------------------------
  it("4. Refunds Workflow Gate: request refund, manager approval, balance reconciliation, and payment status transitions", async () => {
    const folios = await prisma.invoice.findMany({
      where: { reservationId: reservationA.id, organizationId: orgA.id },
      include: { payments: true },
    });
    const invoiceId = folios[0].id;
    // Get the first payment of $300.00
    const payment1 = folios[0].payments.find((p) => new Prisma.Decimal(p.amount).equals(300))!;

    // 1. Attempting to refund more than payment amount must fail
    await expect(
      requestRefund(
        { organizationId: orgA.id },
        {
          paymentId: payment1.id,
          amount: "350.00",
        },
      ),
    ).rejects.toThrow(RefundExceedsPaymentError);

    // 2. Request a valid partial refund of $100.00
    const refund = await requestRefund(
      { organizationId: orgA.id },
      {
        paymentId: payment1.id,
        amount: "100.00",
        reason: "Guest room service discount adjustment",
        userId: userAdminA.id,
      },
    );

    expect(refund.id).toBeDefined();
    expect(refund.status).toBe("pending"); // Awaiting manager approval
    expect(new Prisma.Decimal(refund.amount).toFixed(2)).toBe("100.00");

    // 3. Manager approves refund
    const approvedRefund = await approveRefund(
      { organizationId: orgA.id },
      {
        refundId: refund.id,
        approvedByUserId: userAdminA.id,
        gatewayRef: "re_mock_approved_100",
      },
    );

    expect(approvedRefund.status).toBe("succeeded");
    expect(approvedRefund.approvedBy).toBe(userAdminA.id);
    expect(approvedRefund.providerRef).toBe("re_mock_approved_100");

    // 4. Verify Payment & Invoice status transitions
    // Payment of $300 now has $100 refunded -> 'partially_refunded'
    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment1.id } });
    expect(updatedPayment?.status).toBe("partially_refunded");

    // Invoice net paid is now $715 - $100 = $615 -> status reverts to 'partially_paid' with $100 balance due!
    const updatedFolio = await getInvoiceFolio({ organizationId: orgA.id }, invoiceId);
    expect(updatedFolio.status).toBe("partially_paid");
    expect(updatedFolio.summary.totalCaptured).toBe("715.00");
    expect(updatedFolio.summary.totalRefunded).toBe("100.00");
    expect(updatedFolio.summary.netPaid).toBe("615.00");
    expect(updatedFolio.summary.balanceDue).toBe("100.00");
    expect(updatedFolio.summary.isFullyPaid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 5. Payment Gateway Webhook Signature Verification Gate
  // -------------------------------------------------------------------------
  it("5. Gateway Webhook Gate: verifies Stripe/mock HMAC signatures and rejects invalid or tampered signatures", async () => {
    const adapter = new StripeGatewayAdapter();
    const webhookSecret = "whsec_super_secret_test_key_for_lumina_pms_32bytes";

    // Setup an unpaid invoice for webhook test
    const newReservation = await prisma.reservation.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        guestId: guestA.id,
        code: `BK-WH-${Date.now().toString().slice(-5)}`,
        status: "confirmed",
        checkIn: new Date("2026-12-01"),
        checkOut: new Date("2026-12-02"),
        totalAmount: new Prisma.Decimal("250.00"),
      },
    });

    const newInvoice = await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        reservationId: newReservation.id,
        number: `INV-WH-${Date.now().toString().slice(-4)}`,
        status: "issued",
        subtotal: new Prisma.Decimal("250.00"),
        total: new Prisma.Decimal("250.00"),
      },
    });

    const eventPayload = JSON.stringify({
      id: "evt_test_12345",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_stripe_test_success_999",
          amount: 25000, // 25000 cents = $250.00
          currency: "usd",
          status: "succeeded",
          metadata: {
            organizationId: orgA.id,
            invoiceId: newInvoice.id,
          },
        },
      },
    });

    // 1. Valid Signature
    const validSignature = generateStripeSignature(eventPayload, webhookSecret);
    const verifiedEvent = adapter.verifyWebhookSignature(eventPayload, validSignature, webhookSecret);

    expect(verifiedEvent.id).toBe("evt_test_12345");
    expect(verifiedEvent.type).toBe("payment_intent.succeeded");
    expect(verifiedEvent.data.amount).toBe("250.00");
    expect(verifiedEvent.data.metadata.invoiceId).toBe(newInvoice.id);

    // 2. Tampered Payload with original signature must fail
    const tamperedPayload = eventPayload.replace("25000", "50000");
    expect(() => adapter.verifyWebhookSignature(tamperedPayload, validSignature, webhookSecret)).toThrow(
      WebhookSignatureVerificationError,
    );

    // 3. Invalid Secret must fail
    expect(() => adapter.verifyWebhookSignature(eventPayload, validSignature, "wrong_secret")).toThrow(
      WebhookSignatureVerificationError,
    );

    // 4. Malformed Header must fail
    expect(() => adapter.verifyWebhookSignature(eventPayload, "malformed_header", webhookSecret)).toThrow(
      WebhookSignatureVerificationError,
    );

    // 5. Expired Timestamp must fail
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 1200; // 20 minutes ago
    const expiredSignature = generateStripeSignature(eventPayload, webhookSecret, expiredTimestamp);
    expect(() => adapter.verifyWebhookSignature(eventPayload, expiredSignature, webhookSecret)).toThrow(
      WebhookSignatureVerificationError,
    );

    // 6. MockGatewayAdapter test verification
    const mockAdapter = new MockGatewayAdapter();
    expect(mockAdapter.providerName).toBe("mock_gateway");
    const mockIntent = await mockAdapter.createPaymentIntent({
      amount: new Prisma.Decimal("150.00"),
      currency: "USD",
      metadata: { organizationId: orgA.id },
    });
    expect(mockIntent.id).toContain("mock_pi_");
    expect(mockIntent.amount).toBe("150.00");
  });

  // -------------------------------------------------------------------------
  // 6. Strict Multi-Tenant Isolation Gate
  // -------------------------------------------------------------------------
  it("6. Multi-Tenant Gate: Organization B cannot generate, record payments, or view Organization A's billing data", async () => {
    // Org B cannot generate invoice for Org A's reservation (cross-tenant violation)
    await expect(
      generateInvoiceFromReservation(
        { organizationId: orgB.id },
        { reservationId: reservationA.id },
      ),
    ).rejects.toThrow(CrossTenantViolationError);

    // Org B cannot record payment on Org A's invoice (cross-tenant violation)
    const folios = await prisma.invoice.findMany({
      where: { reservationId: reservationA.id, organizationId: orgA.id },
    });
    const invoiceAId = folios[0].id;

    await expect(
      recordPayment(
        { organizationId: orgB.id },
        {
          invoiceId: invoiceAId,
          amount: "50.00",
        },
      ),
    ).rejects.toThrow(CrossTenantViolationError);

    // Org B cannot view Org A's invoice folio (cross-tenant violation)
    await expect(getInvoiceFolio({ organizationId: orgB.id }, invoiceAId)).rejects.toThrow(CrossTenantViolationError);
  });
});
