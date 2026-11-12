import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import prisma from "@/lib/db";
import { createUserWithContext, authenticate } from "@/lib/auth/actions";
import { hashPassword } from "@/lib/auth/passwords";
import { syncSystemRolesAndPermissions } from "@/lib/permissions";
import { saveIntegrationCredentials, handleWebhookEvent, verifyWebhookSignature } from "@/lib/integrations";
import { syncHospitableTwoWay } from "@/lib/integrations/hospitable";
import {
  createOAuthStateToken,
  verifyOAuthStateToken,
  validateExternalIcalUrl,
  syncExternalIcalCalendar,
  resolveOAuthAuthorizePlan,
} from "@/lib/integrations/ota";
import { createReservation, cancelReservation } from "@/lib/reservations";
import crypto from "crypto";

describe("Staff Accounts, Hospitable Two-Way Sync & OTA Sign-In", () => {
  let orgId = "";
  let adminUserId = "";
  let integrationId = "";
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const ts = Date.now().toString(36);
    const { user, organization } = await createUserWithContext({
      name: "Admin Owner",
      email: `admin-hsp-${ts}@example.test`,
      password: "Password123!",
      organizationName: `Hospitable Test Org ${ts}`,
    });
    orgId = organization.id;
    adminUserId = user.id;

    const integration = await prisma.integration.create({
      data: {
        organizationId: orgId,
        provider: "hospitable",
        name: "Hospitable Two-Way Sync",
        status: "pending_config",
        config: { authMode: "pat" },
      },
    });
    integrationId = integration.id;

    await saveIntegrationCredentials({
      organizationId: orgId,
      integrationId,
      credentials: {
        accessToken: "pat-test-hospitable-token-123456",
        webhookSecret: "test-hospitable-webhook-secret",
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  it("1. Staff accounts: creates staff user with normalized email, role linkage, and supports authentication", async () => {
    const ts = Date.now().toString(36);
    const staffEmail = `FrontDesk.${ts}@example.test`.toLowerCase();
    const role = await prisma.role.findFirst({ where: { organizationId: orgId, key: "front_desk" } });
    expect(role).not.toBeNull();

    const passwordHash = await hashPassword("StaffPass123!");
    const staffUser = await prisma.user.create({
      data: {
        email: staffEmail,
        name: "Maya FrontDesk",
        passwordHash,
        roleKey: "front_desk",
        organizationId: orgId,
        status: "active",
        propertyIds: [],
      },
    });

    const membership = await prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: staffUser.id,
        roleId: role?.id ?? null,
        roleKey: "front_desk",
        status: "active",
        propertyIds: [],
      },
    });

    expect(membership.roleKey).toBe("front_desk");

    const auth = await authenticate(`  ${staffEmail.toUpperCase()}  `, "StaffPass123!");
    expect(auth.user.id).toBe(staffUser.id);
    expect(auth.permissions).toContain("frontdesk.checkin");
    expect(auth.permissions).not.toContain("billing.manage");
  });

  it("2. Hospitable 2-Way Sync: imports properties, host users, guests, and bookings idempotently & pushes local bookings outbound", async () => {
    const ts = Date.now().toString(36);
    const ownerEmail = `host-owner-${ts}@hospitable.test`;
    const guestEmail = `alice-guest-${ts}@airbnb.test`;
    const checkIn = new Date(Date.UTC(2027, 4, 10));
    const checkOut = new Date(Date.UTC(2027, 4, 13));
    const checkInIso = checkIn.toISOString().slice(0, 10);
    const checkOutIso = checkOut.toISOString().slice(0, 10);

    const outboundCalls: Array<{ url: string; method: string; body: any }> = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/v2/properties?") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: `hsp-prop-${ts}`,
                name: "Oceanfront Villa",
                time_zone: "America/Los_Angeles",
                currency: "USD",
                address: { street: "77 Pacific Way", city: "Malibu", state: "CA", country: "US", postal_code: "90265" },
                capacity: { max: 4 },
                settings: { check_in: "15:00", check_out: "11:00" },
                user: { id: "hsp-u-1", name: "Sam Host", email: ownerEmail, phone: "+13105550199" },
                listings: [{ platform: "airbnb", base_price: 250 }],
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/v2/reservations?") && method === "GET") {
        if (!url.includes(`properties[]=${encodeURIComponent(`hsp-prop-${ts}`)}`)) {
          return new Response(
            JSON.stringify({
              status_code: 400,
              reason_phrase: "The properties field is required.",
              errors: { properties: ["The properties field is required."] },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            data: [
              {
                id: `hsp-res-${ts}`,
                code: `HM-${ts.toUpperCase()}`,
                status: "accepted",
                channel: "airbnb",
                property_id: `hsp-prop-${ts}`,
                arrival_date: checkInIso,
                departure_date: checkOutIso,
                guests: { adult_count: 2, child_count: 1 },
                guest: {
                  id: "hsp-g-1",
                  first_name: "Alice",
                  last_name: "Traveler",
                  email: guestEmail,
                  phone: "+14155550101",
                  locale: "en-US",
                  location: "San Francisco, CA",
                },
                financials: {
                  currency: "USD",
                  host: { revenue: { amount: 75000 } }, // $750.00
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/calendar") && method === "PUT") {
        outboundCalls.push({
          url,
          method,
          body: init?.body ? JSON.parse(String(init.body)) : {},
        });
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    // First sync: imports property, host user, guest, and booking
    const firstSummary = await syncHospitableTwoWay({
      organizationId: orgId,
      integrationId,
      userId: adminUserId,
    });

    expect(firstSummary.propertiesImported).toBe(1);
    expect(firstSummary.usersImported).toBe(1);
    expect(firstSummary.guestsImported).toBe(1);
    expect(firstSummary.bookingsImported).toBe(1);
    expect(firstSummary.conflicts).toHaveLength(0);

    // Verify imported Property, User, Guest, Reservation & RoomNight locks
    const importedProp = await prisma.property.findFirst({
      where: { organizationId: orgId, name: "Oceanfront Villa" },
      include: { rooms: true },
    });
    expect(importedProp).not.toBeNull();
    expect(importedProp?.rooms.length).toBe(1);

    const importedHostUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    expect(importedHostUser).not.toBeNull();
    expect(importedHostUser?.organizationId).toBe(orgId);

    const importedGuest = await prisma.guest.findFirst({ where: { organizationId: orgId, email: guestEmail } });
    expect(importedGuest).not.toBeNull();
    expect(importedGuest?.firstName).toBe("Alice");

    const importedRes = await prisma.reservation.findFirst({
      where: { organizationId: orgId, propertyId: importedProp!.id },
      include: { roomNights: true },
    });
    expect(importedRes).not.toBeNull();
    expect(importedRes?.source).toBe("ota");
    expect(Number(importedRes?.totalAmount)).toBe(750);
    expect(importedRes?.roomNights.length).toBe(3);

    // Second sync: idempotent (0 new properties/bookings created)
    const secondSummary = await syncHospitableTwoWay({
      organizationId: orgId,
      integrationId,
      userId: adminUserId,
    });
    expect(secondSummary.propertiesImported).toBe(0);
    expect(secondSummary.propertiesUpdated).toBe(1);
    expect(secondSummary.bookingsImported).toBe(0);
    expect(secondSummary.bookingsUpdated).toBe(1);

    // Outbound 2-way sync on local PMS booking creation & cancellation
    outboundCalls.length = 0;
    const localStart = new Date(Date.UTC(2027, 5, 1));
    const localEnd = new Date(Date.UTC(2027, 5, 3));
    const createdLocal = await createReservation({
      organizationId: orgId,
      propertyId: importedProp!.id,
      roomIds: [importedProp!.rooms[0].id],
      checkIn: localStart,
      checkOut: localEnd,
      guest: { firstName: "Bob", lastName: "Local", email: `bob-${ts}@example.test` },
      source: "direct",
      status: "confirmed",
    });

    expect(outboundCalls.length).toBe(1);
    expect(outboundCalls[0].url).toContain(`/properties/hsp-prop-${ts}/calendar`);
    expect(outboundCalls[0].body.dates).toEqual([
      { date: "2027-06-01", available: false },
      { date: "2027-06-02", available: false },
    ]);

    // Cancelling releases availability outbound back to Hospitable
    outboundCalls.length = 0;
    await cancelReservation(createdLocal.id!, orgId, "Test cancel", adminUserId);
    expect(outboundCalls.length).toBe(1);
    expect(outboundCalls[0].body.dates).toEqual([
      { date: "2027-06-01", available: true },
      { date: "2027-06-02", available: true },
    ]);
  });

  it("3. Hospitable Webhooks: verifies HMAC SHA-256 signature and ingests reservation.created idempotently", async () => {
    const ts = Date.now().toString(36);
    const payloadObj = {
      id: `wh-hsp-${ts}`,
      action: "reservation.created",
      data: {
        id: `hsp-wh-res-${ts}`,
        code: `WH-${ts.toUpperCase()}`,
        status: "accepted",
        channel: "booking",
        property: { id: `hsp-wh-prop-${ts}`, name: "Webhook Chalet", currency: "USD" },
        arrival_date: "2027-07-10",
        departure_date: "2027-07-12",
        guest: { first_name: "Clara", last_name: "Booking", email: `clara-${ts}@booking.test` },
        financials: { currency: "USD", host: { revenue: { amount: 40000 } } },
      },
    };
    const raw = JSON.stringify(payloadObj);
    const sig = "sha256=" + crypto.createHmac("sha256", "test-hospitable-webhook-secret").update(raw).digest("hex");
    expect(verifyWebhookSignature(raw, sig, "test-hospitable-webhook-secret")).toBe(true);

    const res1 = await handleWebhookEvent({
      organizationId: orgId,
      provider: "hospitable",
      integrationId,
      eventType: "reservation.created",
      externalId: payloadObj.id,
      payload: payloadObj,
      signatureVerified: true,
    });
    expect(res1.status).toBe("processed");
    expect(res1.duplicate).toBe(false);

    const webhookBooking = await prisma.reservation.findFirst({
      where: { organizationId: orgId, code: `HSP-WH-${ts.toUpperCase()}` },
    });
    expect(webhookBooking).not.toBeNull();

    // Duplicate delivery ignored
    const res2 = await handleWebhookEvent({
      organizationId: orgId,
      provider: "hospitable",
      integrationId,
      eventType: "reservation.created",
      externalId: payloadObj.id,
      payload: payloadObj,
      signatureVerified: true,
    });
    expect(res2.status).toBe("ignored");
    expect(res2.duplicate).toBe(true);
  });

  it("4. OTA Sign-In & iCal Sync: signed state roundtrip, SSRF guard, channel links, and live .ics import", async () => {
    const state = await createOAuthStateToken({
      organizationId: orgId,
      userId: adminUserId,
      provider: "airbnb_ical",
    });
    const decoded = await verifyOAuthStateToken(state);
    expect(decoded.organizationId).toBe(orgId);
    expect(decoded.provider).toBe("airbnb_ical");

    const airbnbPlan = await resolveOAuthAuthorizePlan({
      origin: "https://pms.example.com",
      organizationId: orgId,
      userId: adminUserId,
      provider: "airbnb_ical",
    });
    expect(airbnbPlan.authorizeUrl).toContain("airbnb.com");

    const bookingPlan = await resolveOAuthAuthorizePlan({
      origin: "https://pms.example.com",
      organizationId: orgId,
      userId: adminUserId,
      provider: "booking_com",
    });
    expect(bookingPlan.authorizeUrl).toContain("booking.com");

    // SSRF guard checks
    expect(() => validateExternalIcalUrl("http://airbnb.com/cal.ics")).toThrow();
    expect(() => validateExternalIcalUrl("https://127.0.0.1/cal.ics")).toThrow();
    expect(() => validateExternalIcalUrl("https://169.254.169.254/latest")).toThrow();
    expect(() => validateExternalIcalUrl("https://192.168.1.50/cal.ics")).toThrow();

    const prop = await prisma.property.findFirst({ where: { organizationId: orgId } });
    expect(prop).not.toBeNull();

    globalThis.fetch = vi.fn(async () => {
      const sampleIcs = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:airbnb-ext-991",
        "SUMMARY:Reserved (Airbnb)",
        "DTSTART;VALUE=DATE:20270801",
        "DTEND;VALUE=DATE:20270804",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      return new Response(sampleIcs, { status: 200 });
    }) as typeof fetch;

    const icalRes = await syncExternalIcalCalendar({
      organizationId: orgId,
      propertyId: prop!.id,
      provider: "airbnb_ical",
      icalUrl: "https://www.airbnb.com/calendar/ical/12345.ics?s=secret",
      userId: adminUserId,
    });

    expect(icalRes.eventsFound).toBe(1);
    expect(icalRes.imported).toBe(1);
    expect(icalRes.conflicts).toHaveLength(0);
  });
});
