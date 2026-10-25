import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "SEED REFUSED: Seeding is disabled in production to protect existing data. Set ALLOW_PRODUCTION_SEED=true to override explicitly."
    );
  }

  // Clean slate for local demo databases.
  await prisma.auditLog.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.aiToolExecution.deleteMany();
  await prisma.aiAgentExecution.deleteMany();
  await prisma.aiProviderCredential.deleteMany();
  await prisma.aiProviderConfig.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatbotMessage.deleteMany();
  await prisma.chatbotConversation.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.supportConversation.deleteMany();
  await prisma.knowledgeBaseDocument.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.guestRequest.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.reservationRoom.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.seasonalRate.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.roomAmenity.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.propertyMembership.deleteMany();
  await prisma.property.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

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
      organizationId: null,
      status: "active",
    },
  });

  const organization = await prisma.organization.create({
    data: { name: "Lumina Hospitality Group", slug: "lumina-hospitality" },
  });
  await prisma.organizationMembership.create({
    data: { organizationId: organization.id, userId: adminUser.id, roleKey: "admin", status: "active", propertyIds: [] },
  });

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

  const standard = await prisma.roomType.create({ data: { propertyId: property.id, name: "Standard Queen", capacity: 2, sizeSqm: 18, bedType: "Queen", baseRate: 129, depositType: "none", depositAmount: 0, status: "active" } });
  const deluxe = await prisma.roomType.create({ data: { propertyId: property.id, name: "Deluxe King", capacity: 2, sizeSqm: 24, bedType: "King", baseRate: 189, depositType: "none", depositAmount: 0, status: "active" } });
  const suite = await prisma.roomType.create({ data: { propertyId: property.id, name: "Ocean Suite", capacity: 3, sizeSqm: 45, bedType: "King", baseRate: 329, depositType: "none", depositAmount: 0, status: "active" } });

  const rooms: { id: string; number: string; roomTypeId: string }[] = [];
  for (const [number, roomTypeId] of [
    ["101", standard.id],
    ["102", standard.id],
    ["201", deluxe.id],
    ["202", deluxe.id],
    ["301", suite.id],
  ] as const) {
    const room = await prisma.room.create({ data: { propertyId: property.id, roomTypeId, number, status: "available" } });
    rooms.push({ id: room.id, number, roomTypeId });
  }

  await prisma.ratePlan.create({ data: { propertyId: property.id, name: "Standard rates", type: "fixed", amount: 0, currency: "EUR", isActive: true } });

  const guest = await prisma.guest.create({
    data: { organizationId: organization.id, firstName: "Maria", lastName: "Silva", email: "maria.silva@example.com", phone: "+351 900 000 111" },
  });

  const reservation = await prisma.reservation.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      code: "LMN-DEMO01",
      status: "confirmed",
      checkIn: new Date(Date.now() + 14 * 86400000),
      checkOut: new Date(Date.now() + 16 * 86400000),
      adults: 2,
      children: 0,
      guestId: guest.id,
      source: "direct",
      notes: "Late arrival requested. High floor preferred.",
    },
  });
  await prisma.reservationRoom.create({
    data: { reservationId: reservation.id, roomId: rooms[0].id, guestId: guest.id },
  });

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      reservationId: reservation.id,
      number: "INV-1001",
      status: "issued",
      subtotal: 258,
      tax: 59.34,
      total: 317.34,
      currency: "EUR",
      dueDate: new Date(Date.now() + 7 * 86400000),
    },
  });
  await prisma.invoiceLineItem.create({
    data: { invoiceId: invoice.id, description: "2 nights · Standard Queen", quantity: 2, unitAmount: 129, total: 258 },
  });
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

  await prisma.housekeepingTask.create({
    data: { propertyId: property.id, roomId: rooms[0].id, status: "pending", priority: "normal", title: "Post-stay cleaning", notes: "Turnaround after departure.", dueAt: new Date(Date.now() + 86400000) },
  });

  await prisma.knowledgeBaseDocument.create({
    data: {
      organizationId: organization.id,
      propertyId: property.id,
      type: "faq",
      title: "Check-in and check-out",
      content: "Check-in from 3:00 PM, check-out until 11:00 AM. Early check-in subject to availability. Late check-out subject to availability.",
      status: "active",
    },
  });

  console.log("Seed completed.");
  console.log("Admin login: admin@lumina.pms / Password123!");
  console.log(`Demo property: ${property.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
