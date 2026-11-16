import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const org = await prisma.organization.findFirst({
    where: { slug: "the-penthouse-living" },
    include: {
      properties: { include: { rooms: true } },
      users: { select: { email: true, name: true, roleKey: true } },
    },
  });

  console.log("=== ORGANIZATION ===");
  console.log("Name:", org?.name, "ID:", org?.id);
  console.log("Properties count:", org?.properties.length);
  for (const p of org?.properties || []) {
    console.log(` - ${p.name} (${p.code}) | Currency: ${p.currency} | Rooms: ${p.rooms.length}`);
  }

  const resCount = await prisma.reservation.count({ where: { organizationId: org.id } });
  console.log("\nReservations count:", resCount);

  const nightsCount = await prisma.roomNight.count({ where: { organizationId: org.id } });
  console.log("Room nights count:", nightsCount);

  const invCount = await prisma.invoice.count({ where: { organizationId: org.id } });
  console.log("Invoices count:", invCount);

  const payCount = await prisma.payment.count({ where: { organizationId: org.id } });
  console.log("Payments count:", payCount);

  const guestsCount = await prisma.guest.count({ where: { organizationId: org.id } });
  console.log("Guests count:", guestsCount);

  // Financial aggregates:
  const invTotal = await prisma.invoice.aggregate({
    where: { organizationId: org.id },
    _sum: { total: true, subtotal: true, tax: true },
  });
  console.log("\nInvoices Total:", invTotal._sum);

  const payTotal = await prisma.payment.aggregate({
    where: { organizationId: org.id, status: "captured" },
    _sum: { amount: true },
  });
  console.log("Payments Captured Total:", payTotal._sum);

  await prisma.$disconnect();
}

check().catch(console.error);
