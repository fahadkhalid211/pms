import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import prisma from "@/lib/db";
import { createUserWithContext, authenticate } from "@/lib/auth/actions";
import { parseCsvRecords } from "@/lib/csv";
import * as sessionModule from "@/lib/auth/session";
import { POST as bulkPropertiesPost } from "@/app/api/properties/bulk/route";
import { POST as bulkStaffPost } from "@/app/api/staff/bulk/route";

describe("Bulk Imports & Front Desk ISO Arrival Filtering", () => {
  let orgId = "";
  let adminUser: {
    id: string;
    email: string;
    name: string;
    roleKey: string;
    organizationId: string;
    permissions: string[];
  } | null = null;

  beforeAll(async () => {
    const ts = Date.now().toString(36);
    const { user, organization } = await createUserWithContext({
      name: "Bulk Test Admin",
      email: `bulk-admin-${ts}@example.test`,
      password: "Password123!",
      organizationName: `Bulk Test Org ${ts}`,
    });
    orgId = organization.id;
    adminUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? "Bulk Test Admin",
      roleKey: user.roleKey,
      organizationId: organization.id,
      permissions: ["*"],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
  });

  it("1. parseCsvRecords parses RFC 4180 CSV with quoted commas, escaped quotes, CRLF, and normalized headers", () => {
    const csv = [
      "Name,Code,Address Line1,City,Rooms Count,Base Rate",
      '"Grand Villa, North",GVN,"100 ""Ocean"" Blvd",Miami,3,240',
      "Mountain Cabin,MCB,42 Pine Trail,Denver,2,185\r",
      "",
    ].join("\r\n");

    const records = parseCsvRecords(csv);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      name: "Grand Villa, North",
      code: "GVN",
      address_line1: '100 "Ocean" Blvd',
      city: "Miami",
      rooms_count: "3",
      base_rate: "240",
    });
    expect(records[1].name).toBe("Mountain Cabin");
    expect(records[1].rooms_count).toBe("2");
  });

  it("2. Front Desk ISO YYYY-MM-DD arrival comparison prevents future dates like Nov 15 from matching Nov 12", () => {
    const todayIso = "2026-11-12";
    const arrivals = [
      { id: "due-today", status: "confirmed", checkIn: "2026-11-12T15:00:00.000Z" },
      { id: "nov-15", status: "confirmed", checkIn: "2026-11-15T15:00:00.000Z" },
      { id: "overdue-nov-11", status: "confirmed", checkIn: "2026-11-11T15:00:00.000Z" },
    ];

    // Confirm why old .toDateString() failed: "Sun Nov 15 2026" <= "Thu Nov 12 2026" was true lexicographically
    expect("Sun Nov 15 2026" <= "Thu Nov 12 2026").toBe(true);

    const exactToday = arrivals.filter((r) => r.checkIn.slice(0, 10) === todayIso);
    const todayOrOverdue = arrivals.filter((r) => r.checkIn.slice(0, 10) <= todayIso);
    const upcoming7d = arrivals.filter(
      (r) => r.checkIn.slice(0, 10) > todayIso && r.checkIn.slice(0, 10) <= "2026-11-19",
    );

    expect(exactToday.map((r) => r.id)).toEqual(["due-today"]);
    expect(todayOrOverdue.map((r) => r.id)).toEqual(["due-today", "overdue-nov-11"]);
    expect(upcoming7d.map((r) => r.id)).toEqual(["nov-15"]);
  });

  it("3. POST /api/properties/bulk creates properties with rooms & skips duplicates within the organization", async () => {
    vi.spyOn(sessionModule, "requirePermission").mockResolvedValue(adminUser as never);

    const firstReq = new Request("http://localhost/api/properties/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: [
          { name: "Harbor Loft", code: "HBL", city: "Seattle", roomsCount: 2, roomTypeName: "Loft", baseRate: 210 },
          { name: "Canyon Suite", code: "CYN", city: "Sedona", roomsCount: 1, baseRate: 175 },
          { name: "Harbor Loft", code: "HBL2", city: "Seattle", roomsCount: 1 },
        ],
      }),
    });

    const res = await bulkPropertiesPost(firstReq);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.imported).toBe(2);
    expect(json.data.skippedCount).toBe(1);

    const harbor = await prisma.property.findFirst({
      where: { organizationId: orgId, code: "HBL" },
      include: { rooms: true, roomTypes: true },
    });
    expect(harbor).not.toBeNull();
    expect(harbor?.rooms).toHaveLength(2);
    expect(harbor?.roomTypes[0]?.name).toBe("Loft");
  });

  it("4. POST /api/staff/bulk creates staff accounts scoped to properties, hashes explicit passwords, and invites users without password", async () => {
    vi.spyOn(sessionModule, "requirePermission").mockResolvedValue(adminUser as never);

    const ts = Date.now().toString(36);
    const directEmail = `desk.${ts}@example.test`;
    const invitedEmail = `housekeeping.${ts}@example.test`;

    const req = new Request("http://localhost/api/staff/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        users: [
          {
            name: "Alex Desk",
            email: directEmail.toUpperCase(),
            roleKey: "front_desk",
            password: "StaffPassword123!",
            propertyCodes: ["HBL"],
          },
          {
            name: "Jordan Keeper",
            email: invitedEmail,
            roleKey: "housekeeping",
            propertyCodes: ["CYN"],
          },
          {
            name: "Duplicate Alex",
            email: directEmail,
            roleKey: "manager",
          },
        ],
      }),
    });

    const res = await bulkStaffPost(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.imported).toBe(2);
    expect(json.data.skippedCount).toBe(1);

    const authDirect = await authenticate(directEmail, "StaffPassword123!");
    expect(authDirect.user.roleKey).toBe("front_desk");
    expect(authDirect.permissions).toContain("frontdesk.checkin");

    const invitedUser = await prisma.user.findUnique({
      where: { email: invitedEmail },
      include: { propertyMemberships: true },
    });
    expect(invitedUser?.status).toBe("invited");
    expect(invitedUser?.propertyMemberships).toHaveLength(1);
  });
});
