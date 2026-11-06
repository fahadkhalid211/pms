import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("WP1 Gate: Schema v2, Relations, and Constraints", () => {
  it("verifies all core spec models exist on Prisma client", () => {
    // Spec §17 and WP1 demand 35+ models
    const requiredModels = [
      "user",
      "organization",
      "organizationMembership",
      "role",
      "permission",
      "rolePermission",
      "property",
      "propertyMembership",
      "roomType",
      "room",
      "amenity",
      "roomAmenity",
      "ratePlan",
      "seasonalRate",
      "discount",
      "guest",
      "guestProfile",
      "guestRequest",
      "reservation",
      "reservationRoom",
      "roomNight",
      "invoice",
      "invoiceLineItem",
      "payment",
      "refund",
      "housekeepingTask",
      "taskComment",
      "maintenanceTicket",
      "notification",
      "supportConversation",
      "supportMessage",
      "chatbotConversation",
      "chatbotMessage",
      "knowledgeBaseDocument",
      "knowledgeBaseChunk",
      "aiProviderConfig",
      "aiProviderCredential",
      "encryptedCredential",
      "aiAgentExecution",
      "aiToolExecution",
      "approvalRequest",
      "integration",
      "webhookEvent",
      "auditLog",
      "idempotencyKey",
    ];

    for (const model of requiredModels) {
      expect((prisma as Record<string, any>)[model]).toBeDefined();
    }
    expect(requiredModels.length).toBeGreaterThanOrEqual(35);
  });

  it("enforces double-booking protection via RoomNight(roomId, date) unique constraint", async () => {
    const org = await prisma.organization.findFirstOrThrow({ where: { slug: "lumina-hospitality" } });
    const property = await prisma.property.findFirstOrThrow({ where: { organizationId: org.id } });
    const room = await prisma.room.findFirstOrThrow({ where: { propertyId: property.id } });

    const testDate = new Date("2028-06-15T00:00:00.000Z");

    // Clean any leftover test records for this date
    await prisma.roomNight.deleteMany({
      where: { roomId: room.id, date: testDate },
    });

    // First insert succeeds
    const firstNight = await prisma.roomNight.create({
      data: {
        organizationId: org.id,
        propertyId: property.id,
        roomId: room.id,
        date: testDate,
        status: "reserved",
        price: 150.0,
      },
    });
    expect(firstNight.id).toBeDefined();

    // Duplicate insert for the exact same room and date MUST fail with Prisma P2002
    let errorCaught: any = null;
    try {
      await prisma.roomNight.create({
        data: {
          organizationId: org.id,
          propertyId: property.id,
          roomId: room.id,
          date: testDate,
          status: "reserved",
          price: 150.0,
        },
      });
    } catch (e) {
      errorCaught = e;
    }

    expect(errorCaught).not.toBeNull();
    expect(errorCaught.code).toBe("P2002"); // Unique constraint failed

    // Cleanup
    await prisma.roomNight.delete({ where: { id: firstNight.id } });
  });

  it("verifies GuestProfile, EncryptedCredential with keyVersion, and IdempotencyKey models", async () => {
    const org = await prisma.organization.findFirstOrThrow({ where: { slug: "lumina-hospitality" } });
    const guest = await prisma.guest.findFirstOrThrow({ where: { organizationId: org.id } });

    const profile = await prisma.guestProfile.findUnique({
      where: { guestId: guest.id },
    });
    expect(profile).not.toBeNull();
    expect(profile?.organizationId).toBe(org.id);

    const cred = await prisma.encryptedCredential.findFirst({
      where: { organizationId: org.id },
    });
    expect(cred).not.toBeNull();
    expect(cred?.keyVersion).toBe(1);

    // Verify IdempotencyKey table can store keys
    const testKey = `test-idemp-${Date.now()}`;
    const idemp = await prisma.idempotencyKey.create({
      data: {
        organizationId: org.id,
        key: testKey,
        route: "/api/reservations",
        statusCode: 201,
        responseBody: { success: true },
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    expect(idemp.id).toBeDefined();
    await prisma.idempotencyKey.delete({ where: { id: idemp.id } });
  });

  it("verifies MySQL FULLTEXT indexes exist on knowledge base tables", async () => {
    const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string; INDEX_TYPE: string }>>`
      SELECT DISTINCT TABLE_NAME, INDEX_TYPE
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_TYPE = 'FULLTEXT'
        AND TABLE_NAME IN ('KnowledgeBaseDocument', 'KnowledgeBaseChunk')
    `;
    const tables = rows.map((r) => r.TABLE_NAME.toLowerCase()).sort();
    expect(tables).toEqual(["knowledgebasechunk", "knowledgebasedocument"]);
  });
});
