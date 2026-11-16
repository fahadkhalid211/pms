import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const org = await prisma.organization.findFirst({
    where: { slug: "the-penthouse-living" },
  });

  const res = await prisma.reservation.findMany({
    where: { organizationId: org.id },
    include: {
      invoices: { include: { lineItems: true, payments: true } },
      roomNights: true,
      property: true,
    },
  });

  const stats = {
    GBP: {
      reservations: 0,
      nights: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
      paid: 0,
      balanceDue: 0,
    },
    EUR: {
      reservations: 0,
      nights: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
      paid: 0,
      balanceDue: 0,
    },
  };

  for (const r of res) {
    const cur = r.currency === "EUR" ? "EUR" : "GBP";
    stats[cur].reservations++;
    stats[cur].nights += r.roomNights.length;

    for (const inv of r.invoices) {
      stats[cur].total += Number(inv.total);
      stats[cur].subtotal += Number(inv.subtotal);
      stats[cur].tax += Number(inv.tax);

      let invPaid = 0;
      for (const p of inv.payments) {
        if (p.status === "captured") {
          invPaid += Number(p.amount);
        }
      }
      stats[cur].paid += invPaid;
      stats[cur].balanceDue += Math.max(0, Number(inv.total) - invPaid);
    }
  }

  console.log("=== DETAILED CURRENCY RECONCILIATION ===");
  console.log("GBP STATS:", stats.GBP);
  console.log("EUR STATS:", stats.EUR);
  console.log("TOTAL RESERVATIONS:", stats.GBP.reservations + stats.EUR.reservations);
  console.log("TOTAL ROOM NIGHTS:", stats.GBP.nights + stats.EUR.nights);
  console.log("TOTAL REVENUE:", (stats.GBP.total + stats.EUR.total).toFixed(2));
  console.log("TOTAL PAID:", (stats.GBP.paid + stats.EUR.paid).toFixed(2));
}

check().then(() => prisma.$disconnect());
