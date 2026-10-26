import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { dal } from "@/lib/dal";
import { renderTemplate } from "@/lib/notifications/templates";
import { getMockEmailAdapter } from "@/lib/notifications/providers";
import {
  NotFoundError,
  CrossTenantViolationError,
} from "@/lib/errors";

describe("WP7 Gate: Notifications Queue, Branded Templates, Delivery Logs, Preferences & Reminders", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let propertyA: { id: string };
  let guestA: { id: string; email: string | null };
  let guestB: { id: string; email: string | null };
  let reservationA: { id: string; code: string };

  const mockEmail = getMockEmailAdapter();

  beforeAll(async () => {
    mockEmail.clear();

    // 1. Create Organization A
    orgA = await prisma.organization.create({
      data: {
        name: "WP7 Notifications Org A",
        slug: `wp7-org-a-${Date.now()}`,
      },
    });

    // 2. Create Property A with branding fields
    propertyA = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        name: "Lumina Grand Azure Resort",
        code: "LGA",
        currency: "USD",
        email: "concierge@lumina-azure.local",
        phone: "+1-800-555-0199",
        addressLine1: "777 Ocean Boulevard",
        city: "Miami",
        state: "FL",
        postalCode: "33139",
      },
    });

    // 3. Create Guest A
    guestA = await prisma.guest.create({
      data: {
        organizationId: orgA.id,
        firstName: "Victoria",
        lastName: "Sterling",
        email: `victoria-${Date.now()}@sterling-luxury.com`,
        phone: "+1-555-234-5678",
      },
    });

    // 4. Create Guest B
    guestB = await prisma.guest.create({
      data: {
        organizationId: orgA.id,
        firstName: "Alexander",
        lastName: "Wright",
        email: `alex-${Date.now()}@wright-holdings.com`,
        phone: "+1-555-876-5432",
      },
    });

    // 5. Create Room Type & Room for Reservation
    const roomType = await prisma.roomType.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        name: "Azure Royal Penthouse",
        baseRate: new Prisma.Decimal("950.00"),
        capacity: 4,
      },
    });

    const room = await prisma.room.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        roomTypeId: roomType.id,
        number: "PH-01",
        floor: "14",
      },
    });

    // 6. Create Confirmed Reservation in 48 hours (in pre-arrival window: 24h-72h)
    const in48Hours = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const in96Hours = new Date(Date.now() + 96 * 60 * 60 * 1000);

    reservationA = await prisma.reservation.create({
      data: {
        organizationId: orgA.id,
        propertyId: propertyA.id,
        guestId: guestA.id,
        code: `RES-${Date.now()}`,
        status: "confirmed",
        checkIn: in48Hours,
        checkOut: in96Hours,
        adults: 2,
        children: 0,
        totalAmount: new Prisma.Decimal("1900.00"),
        rooms: {
          create: {
            organizationId: orgA.id,
            roomId: room.id,
            nightlyRate: new Prisma.Decimal("950.00"),
          },
        },
      },
    });

    // 7. Create Organization B for multi-tenant isolation gate
    orgB = await prisma.organization.create({
      data: {
        name: "WP7 Isolated Org B",
        slug: `wp7-org-b-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    mockEmail.clear();
  });

  // -------------------------------------------------------------------------
  // 1. Transactional Queue Lifecycle Gate
  // -------------------------------------------------------------------------
  it("1. Queue Lifecycle Gate: Enqueues, processes via worker, marks sent, records delivery log and dispatches email", async () => {
    mockEmail.clear();

    const enqueued = await dal.notifications.enqueue(
      { organizationId: orgA.id, propertyId: propertyA.id },
      {
        channel: "email",
        type: "pre_arrival",
        templateCode: "pre_arrival",
        toEmail: guestA.email,
        guestId: guestA.id,
        variables: {
          guestName: "Victoria Sterling",
          bookingCode: reservationA.code,
          checkInDate: "Nov 15, 2026",
          checkOutDate: "Nov 18, 2026",
          roomType: "Azure Royal Penthouse",
        },
      },
    );

    expect(enqueued.status).toBe("queued");
    expect(enqueued.id).toBeDefined();

    // Verify stored in DB
    const fetchedBefore = await dal.notifications.findUnique(
      { organizationId: orgA.id },
      enqueued.id,
    );
    expect(fetchedBefore.status).toBe("queued");
    expect(fetchedBefore.toEmail).toBe(guestA.email);

    // Process queue
    const processResult = await dal.notifications.processQueue({ organizationId: orgA.id }, 10);
    expect(processResult.processed).toBeGreaterThanOrEqual(1);
    expect(processResult.succeeded).toBeGreaterThanOrEqual(1);

    // Verify notification status updated to sent
    const fetchedAfter = await dal.notifications.findUnique(
      { organizationId: orgA.id },
      enqueued.id,
    );
    expect(fetchedAfter.status).toBe("sent");
    expect(fetchedAfter.sentAt).not.toBeNull();

    // Verify Mock Provider recorded message
    const sentMessages = mockEmail.getSentMessages();
    const sentEmail = sentMessages.find((m) => m.to === guestA.email);
    expect(sentEmail).toBeDefined();
    expect(sentEmail?.subject).toContain("Upcoming Stay");
    expect(sentEmail?.html).toContain("Lumina Grand Azure Resort");
    expect(sentEmail?.html).toContain("Victoria Sterling");

    // Verify Delivery Logs in DAL
    const logs = await dal.notifications.getDeliveryLogs(
      { organizationId: orgA.id },
      { notificationId: enqueued.id },
    );
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].status).toBe("sent");
    expect(logs[0].provider).toBe("mock_email_provider");
    expect(logs[0].providerRef).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 2. Exponential Backoff & Retries Gate
  // -------------------------------------------------------------------------
  it("2. Retries & Backoff Gate: Handles provider delivery failure, updates attempts, shifts runAt, and succeeds on retry", async () => {
    mockEmail.clear();
    // Inject 1 failure
    mockEmail.simulateFailure(1, "Simulated gateway connection timeout");

    const failedJob = await dal.notifications.enqueue(
      { organizationId: orgA.id, propertyId: propertyA.id },
      {
        channel: "email",
        type: "payment_receipt",
        templateCode: "payment_receipt",
        toEmail: guestA.email,
        variables: {
          guestName: "Victoria Sterling",
          invoiceNumber: "INV-TEST-001",
          amountPaid: "$950.00",
          paymentMethod: "Visa ending in 4242",
          paymentDate: "Oct 26, 2026",
          balanceRemaining: "$0.00",
        },
      },
    );

    // Attempt 1: Process queue -> Provider fails
    const process1 = await dal.notifications.processQueue({ organizationId: orgA.id }, 10);
    expect(process1.failed).toBeGreaterThanOrEqual(1);

    const jobAfterFail = await dal.notifications.findUnique(
      { organizationId: orgA.id },
      failedJob.id,
    );
    expect(jobAfterFail.status).toBe("queued"); // Stays queued for retry
    expect(jobAfterFail.error).toContain("Simulated gateway connection timeout");

    const payload = jobAfterFail.payload as any;
    expect(payload.attempts).toBe(1);
    expect(payload.deliveryLogs.length).toBe(1);
    expect(payload.deliveryLogs[0].status).toBe("failed");
    // Verify runAt backoff is in the future
    expect(new Date(payload.runAt).getTime()).toBeGreaterThan(Date.now() - 1000);

    // Now manually trigger immediate retry via dal.notifications.retry
    const retriedJob = await dal.notifications.retry({ organizationId: orgA.id }, failedJob.id);
    expect(retriedJob.status).toBe("queued");
    expect(retriedJob.error).toBeNull();

    // Attempt 2: Process queue again -> Mock provider succeeds
    const process2 = await dal.notifications.processQueue({ organizationId: orgA.id }, 10);
    expect(process2.succeeded).toBeGreaterThanOrEqual(1);

    const jobAfterSuccess = await dal.notifications.findUnique(
      { organizationId: orgA.id },
      failedJob.id,
    );
    expect(jobAfterSuccess.status).toBe("sent");
    expect(jobAfterSuccess.sentAt).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. Branded Template Rendering Gate
  // -------------------------------------------------------------------------
  it("3. Template Rendering Gate: Compiles all 5 standard hospitality templates with brand styling and variables", () => {
    const brand = {
      name: "The Grand Royal Palms",
      address: "123 Ocean View Drive, Palm Beach",
      phone: "+1-888-PALM-RESORT",
      email: "guest@palms.local",
      brandColor: "#0f766e",
    };

    // 1. Pre-arrival
    const preArrival = renderTemplate(
      "pre_arrival",
      {
        guestName: "Lady Cynthia",
        bookingCode: "RES-ROYAL-99",
        checkInDate: "2026-12-01",
        checkOutDate: "2026-12-07",
        roomType: "Royal Villa",
      },
      brand,
    );
    expect(preArrival.subject).toContain("Your Upcoming Stay");
    expect(preArrival.html).toContain("The Grand Royal Palms");
    expect(preArrival.html).toContain("#0f766e");
    expect(preArrival.html).toContain("RES-ROYAL-99");
    expect(preArrival.text).toContain("Lady Cynthia");

    // 2. Check-in Welcome
    const welcome = renderTemplate(
      "check_in_welcome",
      {
        guestName: "Lady Cynthia",
        roomNumber: "Villa-7",
        wifiSsid: "Palms-UltraFast",
        wifiPassword: "RoyalStay2026",
        checkOutDate: "2026-12-07",
      },
      brand,
    );
    expect(welcome.subject).toContain("Welcome to The Grand Royal Palms! (Room Villa-7)");
    expect(welcome.html).toContain("Villa-7");
    expect(welcome.html).toContain("Palms-UltraFast");

    // 3. Check-out Thanks
    const checkout = renderTemplate(
      "check_out_thanks",
      {
        guestName: "Lady Cynthia",
        roomNumber: "Villa-7",
        reviewUrl: "https://palms.local/review",
      },
      brand,
    );
    expect(checkout.subject).toContain("Thank You for Staying");
    expect(checkout.html).toContain("Share Your Experience");

    // 4. Payment Receipt
    const receipt = renderTemplate(
      "payment_receipt",
      {
        guestName: "Lady Cynthia",
        invoiceNumber: "INV-2026-888",
        amountPaid: "$5,400.00",
        paymentMethod: "American Express (•••• 1004)",
        paymentDate: "2026-12-01",
        balanceRemaining: "$0.00",
      },
      brand,
    );
    expect(receipt.subject).toContain("Payment Receipt: INV-2026-888");
    expect(receipt.html).toContain("$5,400.00");
    expect(receipt.html).toContain("American Express");

    // 5. Payment Reminder
    const reminder = renderTemplate(
      "payment_reminder",
      {
        guestName: "Lady Cynthia",
        invoiceNumber: "INV-2026-888",
        amountDue: "$1,200.00",
        dueDate: "2026-12-05",
        paymentUrl: "https://palms.local/pay",
      },
      brand,
    );
    expect(reminder.subject).toContain("Payment Reminder: Invoice INV-2026-888");
    expect(reminder.html).toContain("$1,200.00");
    expect(reminder.html).toContain("Pay Securely Online");
  });

  // -------------------------------------------------------------------------
  // 4. Recipient Preferences & Opt-Out Gate
  // -------------------------------------------------------------------------
  it("4. Preferences Gate: Respects guest opt-outs and suppresses dispatch without persisting queued records", async () => {
    // Guest B opts out of automated payment reminders
    await dal.notifications.updatePreferences({ organizationId: orgA.id }, guestB.id, {
      paymentReminders: false,
    });

    const prefs = await dal.notifications.getPreferences(
      { organizationId: orgA.id },
      guestB.id,
    );
    expect(prefs.paymentReminders).toBe(false);
    expect(prefs.emailEnabled).toBe(true);

    // Attempting to enqueue payment reminder for Guest B
    const enqueueRes = await dal.notifications.enqueue(
      { organizationId: orgA.id, propertyId: propertyA.id },
      {
        guestId: guestB.id,
        channel: "email",
        type: "payment_reminder",
        toEmail: guestB.email,
        variables: {
          guestName: "Alexander Wright",
          amountDue: "$400.00",
        },
      },
    );

    // Verify suppressed at gate
    expect(enqueueRes.suppressed).toBe(true);
    expect(enqueueRes.status).toBe("suppressed");
    expect(enqueueRes.reason).toContain("opted out");

    // Verify non-reminder email (e.g. receipt or pre-arrival) is still allowed
    const allowedRes = await dal.notifications.enqueue(
      { organizationId: orgA.id, propertyId: propertyA.id },
      {
        guestId: guestB.id,
        channel: "email",
        type: "payment_receipt",
        toEmail: guestB.email,
        variables: {
          guestName: "Alexander Wright",
          amountPaid: "$400.00",
        },
      },
    );
    expect(allowedRes.suppressed).toBe(false);
    expect(allowedRes.status).toBe("queued");
  });

  // -------------------------------------------------------------------------
  // 5. Automated Reminders Triggers & Deduplication Gate
  // -------------------------------------------------------------------------
  it("5. Automated Reminders Gate: Scans upcoming stays, creates pre-arrival notification, and deduplicates subsequent runs", async () => {
    // Run pre-arrival reminders
    const firstRun = await dal.notifications.runReminders({ organizationId: orgA.id }, "pre_arrival");
    expect(firstRun.preArrival).toBeDefined();
    expect(firstRun.preArrival.triggered).toBeGreaterThanOrEqual(1);
    expect(firstRun.preArrival.reservationIds).toContain(reservationA.id);

    // Verify notification was placed in queue with relatedType: Reservation
    const notifs = await dal.notifications.findMany(
      { organizationId: orgA.id },
      { type: "pre_arrival" },
    );
    const reservationNotif = notifs.find((n) => n.relatedId === reservationA.id);
    expect(reservationNotif).toBeDefined();
    expect(reservationNotif?.toEmail).toBe(guestA.email);

    // Second run: Deduplication gate ensures no duplicate pre-arrival notification is scheduled
    const secondRun = await dal.notifications.runReminders({ organizationId: orgA.id }, "pre_arrival");
    expect(secondRun.preArrival.triggered).toBe(0);
    expect(secondRun.preArrival.reservationIds).not.toContain(reservationA.id);
  });

  // -------------------------------------------------------------------------
  // 6. Strict Multi-Tenant Isolation Gate
  // -------------------------------------------------------------------------
  it("6. Multi-Tenant Gate: Organization B cannot view, process, or retry Organization A's notifications", async () => {
    // Org A enqueues a notification
    const orgANotif = await dal.notifications.enqueue(
      { organizationId: orgA.id, propertyId: propertyA.id },
      {
        channel: "email",
        type: "pre_arrival",
        toEmail: guestA.email,
      },
    );

    // Org B cannot find or view Org A's notification
    await expect(
      dal.notifications.findUnique({ organizationId: orgB.id }, orgANotif.id),
    ).rejects.toThrow(NotFoundError);

    // Org B cannot retry Org A's notification
    await expect(
      dal.notifications.retry({ organizationId: orgB.id }, orgANotif.id),
    ).rejects.toThrow(NotFoundError);

    // Enqueueing notification for another organization throws CrossTenantViolationError
    await expect(
      dal.notifications.enqueue(
        { organizationId: orgB.id },
        {
          organizationId: orgA.id, // Mismatch!
          channel: "email",
          type: "pre_arrival",
          toEmail: "attacker@malicious.local",
        },
      ),
    ).rejects.toThrow(CrossTenantViolationError);

    // Org B processing queue only processes its own jobs (0 jobs processed)
    const orgBProcess = await dal.notifications.processQueue({ organizationId: orgB.id }, 10);
    expect(orgBProcess.processed).toBe(0);
  });
});
