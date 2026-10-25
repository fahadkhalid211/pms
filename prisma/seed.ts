import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from "../lib/permissions";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "SEED REFUSED: Seeding is disabled in production to protect existing data. Set ALLOW_PRODUCTION_SEED=true to override explicitly."
    );
  }

  console.log("Seeding Lumina PMS database...");

  // Clean slate for local demo/development database
  await prisma.auditLog.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.aiToolExecution.deleteMany();
  await prisma.aiAgentExecution.deleteMany();
  await prisma.encryptedCredential.deleteMany();
  await prisma.aiProviderCredential.deleteMany();
  await prisma.aiProviderConfig.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatbotMessage.deleteMany();
  await prisma.chatbotConversation.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.supportConversation.deleteMany();
  await prisma.knowledgeBaseChunk.deleteMany();
  await prisma.knowledgeBaseDocument.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.guestRequest.deleteMany();
  await prisma.roomNight.deleteMany();
  await prisma.reservationRoom.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.guestProfile.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.seasonalRate.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.roomAmenity.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.propertyMembership.deleteMany();
  await prisma.property.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Permissions
  console.log("Seeding permissions...");
  const permissionMap = new Map<string, string>();
  for (const permKey of ALL_PERMISSIONS) {
    const [module] = permKey.split(".");
    const p = await prisma.permission.create({
      data: {
        key: permKey,
        name: permKey.replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `Allows action ${permKey}`,
        module: module || "general",
      },
    });
    permissionMap.set(permKey, p.id);
  }

  // 2. Seed Organization
  console.log("Seeding organization...");
  const organization = await prisma.organization.create({
    data: {
      name: "Lumina Hospitality Group",
      slug: "lumina-hospitality",
    },
  });

  // 3. Seed Roles & RolePermissions for Organization
  console.log("Seeding roles & permissions...");
  const roleMap = new Map<string, string>();
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.create({
      data: {
        organizationId: organization.id,
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        permissions: roleDef.permissions as string[],
        isSystem: true,
      },
    });
    roleMap.set(roleDef.key, role.id);

    // Link RolePermission records
    for (const permKey of roleDef.permissions) {
      const permId = permissionMap.get(permKey);
      if (permId) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // 4. Seed Admin User & Organization Membership
  console.log("Seeding admin user...");
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("SEED_ADMIN_PASSWORD environment variable must be specified in production");
        })()
      : "Password123!");

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@lumina.pms",
      name: "Ava Admin",
      passwordHash,
      roleKey: "admin",
      organizationId: organization.id,
      status: "active",
      propertyIds: [],
    },
  });

  const adminRoleId = roleMap.get("admin");
  await prisma.organizationMembership.create({
    data: {
      organizationId: organization.id,
      userId: adminUser.id,
      roleId: adminRoleId,
      roleKey: "admin",
      status: "active",
      propertyIds: [],
    },
  });

  // 5. Seed Property & Property Membership
  console.log("Seeding property...");
  const property = await prisma.property.create({
    data: {
      organizationId: organization.id,
      name: "The Lumina Boutique",
      code: "LUM",
      addressLine1: "12 Harbor View Road",
      city: "Lisbon",
      state: "Lisbon",
      postalCode: "1100-421",
      country: "Portugal",
      phone: "+351 210 555 014",
      email: "stay@lumina.pms",
      timezone: "Europe/Lisbon",
      currency: "EUR",
      checkInTime: 15,
      checkOutTime: 11,
      taxRate: 23,
      cleaningFee: 45,
    },
  });

  await prisma.propertyMembership.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      userId: adminUser.id,
      isAdmin: true,
      status: "active",
    },
  });

  // 6. Seed Room Types
  console.log("Seeding room types...");
  const standard = await prisma.roomType.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      name: "Standard Queen",
      capacity: 2,
      sizeSqm: 18,
      bedType: "Queen",
      baseRate: 129,
      depositType: "none",
      depositAmount: 0,
      status: "active",
    },
  });

  const deluxe = await prisma.roomType.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      name: "Deluxe King",
      capacity: 2,
      sizeSqm: 24,
      bedType: "King",
      baseRate: 189,
      depositType: "none",
      depositAmount: 0,
      status: "active",
    },
  });

  const suite = await prisma.roomType.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      name: "Ocean Suite",
      capacity: 3,
      sizeSqm: 45,
      bedType: "King",
      baseRate: 329,
      depositType: "none",
      depositAmount: 0,
      status: "active",
    },
  });

  // 7. Seed Rooms
  console.log("Seeding rooms...");
  const rooms: { id: string; number: string; roomTypeId: string }[] = [];
  for (const [number, roomTypeId] of [
    ["101", standard.id],
    ["102", standard.id],
    ["201", deluxe.id],
    ["202", deluxe.id],
    ["301", suite.id],
  ] as const) {
    const room = await prisma.room.create({
      data: {
        organizationId: organization.id,
        propertyId: property.id,
        roomTypeId,
        number,
        floor: number[0],
        status: "available",
      },
    });
    rooms.push({ id: room.id, number, roomTypeId });
  }

  // 8. Seed Rate Plan
  console.log("Seeding rate plan...");
  await prisma.ratePlan.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      name: "Standard rates",
      type: "fixed",
      amount: 0,
      currency: "EUR",
      isActive: true,
    },
  });

  // 9. Seed Guest & Guest Profile
  console.log("Seeding guest & guest profile...");
  const guest = await prisma.guest.create({
    data: {
      organizationId: organization.id,
      firstName: "Maria",
      lastName: "Silva",
      email: "maria.silva@example.com",
      phone: "+351 900 000 111",
      notes: "Preferred guest, allergic to feather pillows.",
    },
  });

  await prisma.guestProfile.create({
    data: {
      organizationId: organization.id,
      guestId: guest.id,
      loyaltyTier: "gold",
      totalStays: 3,
      totalSpent: 950.0,
      preferences: {
        pillowType: "synthetic",
        floorPreference: "high",
        temperatureCelsius: 21,
      },
      idDocumentType: "passport",
      idDocumentNumber: "P12345678",
      idVerified: true,
    },
  });

  // 10. Seed Reservation & ReservationRoom
  console.log("Seeding reservation...");
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 14);
  checkInDate.setHours(15, 0, 0, 0);

  const checkOutDate = new Date();
  checkOutDate.setDate(checkOutDate.getDate() + 16);
  checkOutDate.setHours(11, 0, 0, 0);

  const reservation = await prisma.reservation.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      code: "LMN-DEMO01",
      status: "confirmed",
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults: 2,
      children: 0,
      guestId: guest.id,
      source: "direct",
      notes: "Late arrival requested. High floor preferred.",
    },
  });

  await prisma.reservationRoom.create({
    data: {
      organizationId: organization.id,
      reservationId: reservation.id,
      roomId: rooms[0].id,
      guestId: guest.id,
    },
  });

  // 11. Seed RoomNight records (Double-booking protection)
  console.log("Seeding room nights...");
  const night1 = new Date(checkInDate);
  night1.setHours(0, 0, 0, 0);
  const night2 = new Date(checkInDate);
  night2.setDate(night2.getDate() + 1);
  night2.setHours(0, 0, 0, 0);

  await prisma.roomNight.createMany({
    data: [
      {
        organizationId: organization.id,
        propertyId: property.id,
        roomId: rooms[0].id,
        reservationId: reservation.id,
        date: night1,
        status: "reserved",
        price: 129,
      },
      {
        organizationId: organization.id,
        propertyId: property.id,
        roomId: rooms[0].id,
        reservationId: reservation.id,
        date: night2,
        status: "reserved",
        price: 129,
      },
    ],
  });

  // 12. Seed Invoice & Invoice Line Item
  console.log("Seeding invoice...");
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      reservationId: reservation.id,
      number: "INV-1001",
      status: "paid",
      subtotal: 258,
      tax: 59.34,
      total: 317.34,
      currency: "EUR",
      dueDate: new Date(Date.now() + 7 * 86400000),
    },
  });

  await prisma.invoiceLineItem.create({
    data: {
      organizationId: organization.id,
      invoiceId: invoice.id,
      description: "2 nights · Standard Queen",
      quantity: 2,
      unitAmount: 129,
      total: 258,
    },
  });

  // 13. Seed Payment
  console.log("Seeding payment...");
  await prisma.payment.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      invoiceId: invoice.id,
      reservationId: reservation.id,
      amount: 317.34,
      currency: "EUR",
      status: "captured",
      method: "card",
      provider: "stripe",
      providerRef: "ch_demo_1",
      capturedAt: new Date(),
    },
  });

  // 14. Seed Housekeeping Task
  console.log("Seeding housekeeping task...");
  await prisma.housekeepingTask.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      roomId: rooms[0].id,
      status: "pending",
      priority: "normal",
      title: "Post-stay cleaning",
      notes: "Turnaround after departure.",
      dueAt: new Date(Date.now() + 86400000),
    },
  });

  // 15. Seed Knowledge Base Document & Chunk
  console.log("Seeding knowledge base document & chunks...");
  const kbDoc = await prisma.knowledgeBaseDocument.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      type: "faq",
      title: "Check-in and check-out",
      content:
        "Check-in from 3:00 PM, check-out until 11:00 AM. Early check-in is subject to availability. Late check-out is subject to availability upon request at the front desk.",
      status: "active",
    },
  });

  await prisma.knowledgeBaseChunk.create({
    data: {
      organizationId: organization.id,
      documentId: kbDoc.id,
      chunkIndex: 0,
      content:
        "Check-in from 3:00 PM, check-out until 11:00 AM. Early check-in is subject to availability. Late check-out is subject to availability upon request at the front desk.",
      tokenCount: 35,
    },
  });

  // 16. Seed Encrypted Credential (for AI provider / integration mock)
  console.log("Seeding encrypted credential...");
  await prisma.encryptedCredential.create({
    data: {
      organizationId: organization.id,
      targetType: "ai_provider",
      targetId: "mock_provider_demo",
      encryptedData: "iv:tag:ciphertext:demo",
      keyHint: "dev-key",
      keyVersion: 1,
    },
  });

  console.log("Seed completed successfully!");
  console.log("Admin credentials: admin@lumina.pms / Password123!");
  console.log(`Demo property: ${property.name} (${property.code})`);
}

main()
  .catch((e) => {
    console.error("Error executing seed script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
