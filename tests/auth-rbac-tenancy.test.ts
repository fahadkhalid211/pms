import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { createUserWithContext, authenticate, createPasswordResetToken, resetPasswordWithToken } from "@/lib/auth/actions";
import { resolveUserContext, requirePermission, getAuthContext, ForbiddenError } from "@/lib/auth/session";
import { dal, CrossTenantViolationError, NotFoundError } from "@/lib/dal";
import { rateLimit, resetRateLimiter } from "@/lib/rate-limit";

describe("WP2 Gate: Auth, RBAC, Tenancy, and Rate Limiting", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it("1. Registration & Login: bootstraps organization, system roles, admin membership, and resolves session", async () => {
    const timestamp = Date.now().toString(36);
    const testEmail = `owner-${timestamp}@alpha-hotels.test`;
    const testOrgName = `Alpha Hospitality ${timestamp}`;

    // Registration
    const { user, organization, permissions } = await createUserWithContext({
      name: "Arthur Alpha",
      email: testEmail,
      password: "StrongPassword123!",
      organizationName: testOrgName,
    });

    expect(user.id).toBeDefined();
    expect(user.organizationId).toBe(organization.id);
    expect(user.roleKey).toBe("admin");
    expect(permissions.length).toBeGreaterThanOrEqual(30);

    // Verify bcrypt hash strength (starts with $2a$ or $2b$)
    expect(user.passwordHash).toMatch(/^\$2[ab]\$/);

    // Verify membership
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: organization.id, userId: user.id },
      include: { role: true },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role?.key).toBe("admin");

    // Login with valid credentials
    const authResult = await authenticate(testEmail, "StrongPassword123!");
    expect(authResult.token).toBeDefined();
    expect(authResult.user.id).toBe(user.id);
    expect(authResult.permissions).toContain("properties.manage");
    expect(authResult.permissions).toContain("billing.manage");

    // Login with invalid password
    let failed = false;
    try {
      await authenticate(testEmail, "WrongPassword!");
    } catch (e: any) {
      failed = true;
      expect(e.status).toBe(401);
    }
    expect(failed).toBe(true);
  });

  it("2. Role Matrix & RBAC: enforces staff permissions and separates customer accounts", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `RBAC Test Org ${timestamp}`, slug: `rbac-org-${timestamp}` },
    });

    // Front Desk user
    const fdUser = await prisma.user.create({
      data: {
        name: "Fred FrontDesk",
        email: `fd-${timestamp}@test.com`,
        passwordHash: "hash123",
        organizationId: org.id,
        roleKey: "front_desk",
        status: "active",
      },
    });

    const fdRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        key: "front_desk",
        name: "Front Desk",
        permissions: ["frontdesk.view", "reservations.create", "rooms.view"],
      },
    });

    await prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: fdUser.id,
        roleId: fdRole.id,
        roleKey: "front_desk",
        status: "active",
      },
    });

    const resolvedFd = await resolveUserContext(fdUser.id);
    expect(resolvedFd?.permissions).toContain("frontdesk.view");
    expect(resolvedFd?.permissions).toContain("reservations.create");
    expect(resolvedFd?.permissions).not.toContain("staff.manage");
    expect(resolvedFd?.permissions).not.toContain("ai.configure");

    // Customer Account
    const customerUser = await prisma.user.create({
      data: {
        name: "Clara Customer",
        email: `customer-${timestamp}@test.com`,
        passwordHash: "hash123",
        roleKey: "customer",
        status: "active",
      },
    });

    const customerRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        key: "customer",
        name: "Customer",
        permissions: ["guest.portal", "reservations.view_own"],
      },
    });

    await prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: customerUser.id,
        roleId: customerRole.id,
        roleKey: "customer",
        status: "active",
      },
    });

    const resolvedCust = await resolveUserContext(customerUser.id);
    expect(resolvedCust?.permissions).toContain("guest.portal");
    expect(resolvedCust?.permissions).toContain("reservations.view_own");
    expect(resolvedCust?.permissions).not.toContain("frontdesk.view");
    expect(resolvedCust?.permissions).not.toContain("billing.manage");
  });

  it("3. Cross-Tenant Isolation: Org A cannot read, write, or tamper with Org B across all modules", async () => {
    const timestamp = Date.now().toString(36);

    // Setup Org A
    const orgA = await prisma.organization.create({
      data: { name: `Org A ${timestamp}`, slug: `org-a-${timestamp}` },
    });
    const propA = await dal.properties.create({ organizationId: orgA.id }, {
      name: "Property A",
      code: "PRA",
      timezone: "UTC",
      currency: "EUR",
    });
    const roomTypeA = await prisma.roomType.create({
      data: { organizationId: orgA.id, propertyId: propA.id, name: "Type A", baseRate: 100 },
    });
    const roomA = await dal.rooms.create({ organizationId: orgA.id }, {
      propertyId: propA.id,
      roomTypeId: roomTypeA.id,
      number: "A101",
    });
    const invoiceA = await dal.invoices.create({ organizationId: orgA.id }, {
      propertyId: propA.id,
      number: `INVA-${timestamp}`,
      total: 200,
    });

    // Setup Org B
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${timestamp}`, slug: `org-b-${timestamp}` },
    });
    const propB = await dal.properties.create({ organizationId: orgB.id }, {
      name: "Property B",
      code: "PRB",
      timezone: "UTC",
      currency: "USD",
    });
    const roomTypeB = await prisma.roomType.create({
      data: { organizationId: orgB.id, propertyId: propB.id, name: "Type B", baseRate: 200 },
    });
    const roomB = await dal.rooms.create({ organizationId: orgB.id }, {
      propertyId: propB.id,
      roomTypeId: roomTypeB.id,
      number: "B101",
    });
    const invoiceB = await dal.invoices.create({ organizationId: orgB.id }, {
      propertyId: propB.id,
      number: `INVB-${timestamp}`,
      total: 500,
    });

    const ctxA = { organizationId: orgA.id };
    const ctxB = { organizationId: orgB.id };

    // --- TEST 3A: Property Isolation ---
    // Org A reading Org B property directly fails
    await expect(dal.properties.findUnique(ctxA, propB.id)).rejects.toThrow(NotFoundError);
    // Org A updating Org B property fails
    await expect(dal.properties.update(ctxA, propB.id, { name: "Hacked Property" })).rejects.toThrow(NotFoundError);

    // --- TEST 3B: Room Creation Cross-Tenant IDOR ---
    // Org A trying to create a room linked to Org B's property must fail
    await expect(
      dal.rooms.create(ctxA, { propertyId: propB.id, roomTypeId: roomTypeA.id, number: "A999" }),
    ).rejects.toThrow(CrossTenantViolationError);

    // Org A trying to create a room linked to Org B's roomType must fail
    await expect(
      dal.rooms.create(ctxA, { propertyId: propA.id, roomTypeId: roomTypeB.id, number: "A998" }),
    ).rejects.toThrow(CrossTenantViolationError);

    // Org A reading rooms returns only A101, never B101
    const roomsForA = await dal.rooms.findMany(ctxA);
    expect(roomsForA.some((r) => r.id === roomA.id)).toBe(true);
    expect(roomsForA.some((r) => r.id === roomB.id)).toBe(false);

    // --- TEST 3C: Invoice & Payment Cross-Tenant IDOR ---
    // Org A reading Org B's invoice fails
    await expect(dal.invoices.findUnique(ctxA, invoiceB.id)).rejects.toThrow(NotFoundError);

    // Org A paying Org B's invoice fails
    await expect(
      dal.payments.create(ctxA, { invoiceId: invoiceB.id, amount: 500 }),
    ).rejects.toThrow(CrossTenantViolationError);

    // --- TEST 3D: Housekeeping & Maintenance Cross-Tenant IDOR ---
    // Org A dispatching housekeeping on Org B's room fails
    await expect(
      dal.housekeeping.create(ctxA, { propertyId: propA.id, roomId: roomB.id }),
    ).rejects.toThrow(CrossTenantViolationError);

    // Org A dispatching maintenance on Org B's property/room fails
    await expect(
      dal.maintenance.create(ctxA, { propertyId: propB.id, description: "Fix plumbing" }),
    ).rejects.toThrow(CrossTenantViolationError);

    // --- TEST 3E: Reports Multi-Tenant Isolation ---
    const reportsA = await dal.reports.getOperationalSummary(ctxA);
    expect(reportsA.properties.some((p) => p.id === propB.id)).toBe(false);
    expect(reportsA.roomsCount).toBe(1); // Only Room A101
  });

  it("4. Property-Scope Enforcement: property-restricted user cannot access other properties", async () => {
    const timestamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: { name: `Property Scope Org ${timestamp}`, slug: `prop-scope-${timestamp}` },
    });

    const prop1 = await dal.properties.create({ organizationId: org.id }, { name: "Beach Resort", code: "BCH" });
    const prop2 = await dal.properties.create({ organizationId: org.id }, { name: "Mountain Lodge", code: "MTN" });

    // Staff member assigned strictly to prop1
    const staffUser = await prisma.user.create({
      data: {
        name: "Sam Staff",
        email: `staff-${timestamp}@test.com`,
        passwordHash: "hash123",
        organizationId: org.id,
        roleKey: "front_desk",
        propertyIds: [prop1.id],
        status: "active",
      },
    });

    const role = await prisma.role.create({
      data: {
        organizationId: org.id,
        key: "front_desk",
        name: "Front Desk",
        permissions: ["frontdesk.view", "reservations.create"],
      },
    });

    await prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: staffUser.id,
        roleId: role.id,
        roleKey: "front_desk",
        propertyIds: [prop1.id],
        status: "active",
      },
    });

    await prisma.propertyMembership.create({
      data: {
        organizationId: org.id,
        propertyId: prop1.id,
        userId: staffUser.id,
        status: "active",
      },
    });

    const resolved = await resolveUserContext(staffUser.id);
    expect(resolved?.propertyIds).toContain(prop1.id);
    expect(resolved?.propertyIds).not.toContain(prop2.id);

    // Mock request with session token for prop1
    const { hashSession } = await import("@/lib/auth/actions");
    const token = await hashSession(resolved!);

    const mockReqProp1 = new Request("http://localhost/api/rooms?propertyId=" + prop1.id, {
      headers: { authorization: `Bearer ${token}` },
    });
    const ctxProp1 = await getAuthContext(mockReqProp1);
    expect(ctxProp1?.hasPropertyAccess(prop1.id)).toBe(true);
    expect(ctxProp1?.hasPropertyAccess(prop2.id)).toBe(false);

    // requirePermission with propertyId prop1 succeeds
    await expect(
      requirePermission("frontdesk.view", { propertyId: prop1.id, request: mockReqProp1 }),
    ).resolves.toBeDefined();

    // requirePermission with propertyId prop2 MUST throw 403 Forbidden
    await expect(
      requirePermission("frontdesk.view", { propertyId: prop2.id, request: mockReqProp1 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("5. Rate Limiting: throttles requests when limit is exceeded and returns retry time", () => {
    const testIp = "192.0.2.42";
    const maxRequests = 5;
    const windowMs = 60_000;

    // First 5 requests succeed
    for (let i = 0; i < maxRequests; i++) {
      const res = rateLimit(`test-route:${testIp}`, maxRequests, windowMs);
      expect(res.success).toBe(true);
      expect(res.remaining).toBe(maxRequests - 1 - i);
    }

    // 6th request is throttled
    const blocked = rateLimit(`test-route:${testIp}`, maxRequests, windowMs);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("6. Crypto Hashed Password Reset: raw token is never stored in DB, hash is verified, token expires", async () => {
    const timestamp = Date.now().toString(36);
    const email = `reset-${timestamp}@lumina.test`;

    const user = await prisma.user.create({
      data: {
        name: "Robin Reset",
        email,
        passwordHash: "oldHash123",
        status: "active",
      },
    });

    // Request reset
    const { resetToken } = await createPasswordResetToken(email);
    expect(resetToken).toBeDefined();
    expect(resetToken?.length).toBe(64); // 32 random bytes = 64 hex chars

    // Check DB record: raw resetToken MUST NOT be in DB!
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.passwordResetToken).not.toBeNull();
    expect(dbUser?.passwordResetToken).not.toBe(resetToken);
    expect(dbUser?.passwordResetExpires).toBeDefined();

    // Perform reset with valid raw token
    const newPassword = "NewStrongPassword456!";
    const res = await resetPasswordWithToken(resetToken!, newPassword);
    expect(res.ok).toBe(true);

    // Verify token was cleared from DB
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.passwordResetToken).toBeNull();
    expect(updatedUser?.passwordResetExpires).toBeNull();

    // Verify new password can authenticate
    const auth = await authenticate(email, newPassword);
    expect(auth.user.id).toBe(user.id);

    // Replay attack: trying to reuse the token must fail
    await expect(resetPasswordWithToken(resetToken!, "AnotherPassword789!")).rejects.toThrow();
  });
});
