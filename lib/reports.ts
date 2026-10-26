import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

export interface KpiSummary {
  period: {
    startDate: string;
    endDate: string;
    daysCount: number;
  };
  totalRooms: number;
  roomsAvailableInPeriod: number;
  roomsSold: number;
  occupancyRate: number; // percentage, e.g. 75.5
  roomRevenue: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  adr: Prisma.Decimal; // Average Daily Rate = roomRevenue / roomsSold
  revpar: Prisma.Decimal; // RevPAR = roomRevenue / roomsAvailableInPeriod
  outstandingBalance: Prisma.Decimal;
  cancellationsCount: number;
  noShowsCount: number;
  arrivalsCount: number;
  departuresCount: number;
  roomStatusBreakdown: Record<string, number>;
  dailyBreakdown: Array<{
    date: string;
    roomsSold: number;
    roomRevenue: string;
    occupancyRate: number;
    adr: string;
    revpar: string;
  }>;
}

/**
 * Normalizes start/end dates to midnight UTC.
 */
function normalizeDateRange(startDate?: Date | string, endDate?: Date | string): { start: Date; end: Date; days: number } {
  const end = endDate ? new Date(endDate) : new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 29 * 86400000);
  start.setUTCHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.ceil(diffMs / 86400000));

  return { start, end, days };
}

/**
 * Computes executive KPI metrics and financial summaries scoped strictly by organizationId and optional propertyId.
 */
export async function getExecutiveKpis(input: {
  organizationId: string;
  propertyId?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
}): Promise<KpiSummary> {
  const { start, end, days } = normalizeDateRange(input.startDate, input.endDate);

  // 1. Total rooms and live status distribution
  const rooms = await prisma.room.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    },
    select: { id: true, status: true, propertyId: true },
  });

  const totalRooms = rooms.length;
  const roomsAvailableInPeriod = totalRooms * days;

  const roomStatusBreakdown: Record<string, number> = {
    available: 0,
    occupied: 0,
    dirty: 0,
    clean: 0,
    inspection: 0,
    out_of_order: 0,
  };
  for (const r of rooms) {
    roomStatusBreakdown[r.status] = (roomStatusBreakdown[r.status] ?? 0) + 1;
  }

  // 2. Room Nights sold within date range (status 'reserved')
  const roomNights = await prisma.roomNight.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start, lte: end },
      status: "reserved",
    },
    select: { date: true, price: true, roomId: true },
  });

  const roomsSold = roomNights.length;
  const roomRevenueDecimal = roomNights.reduce(
    (sum, rn) => sum.plus(rn.price),
    new Prisma.Decimal(0),
  );

  // ADR = roomRevenue / roomsSold
  const adrDecimal = roomsSold > 0
    ? roomRevenueDecimal.dividedBy(roomsSold).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal("0.00");

  // RevPAR = roomRevenue / roomsAvailableInPeriod
  const revparDecimal = roomsAvailableInPeriod > 0
    ? roomRevenueDecimal.dividedBy(roomsAvailableInPeriod).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal("0.00");

  // Occupancy rate = (roomsSold / roomsAvailableInPeriod) * 100
  const occupancyRate = roomsAvailableInPeriod > 0
    ? Math.round((roomsSold / roomsAvailableInPeriod) * 10000) / 100
    : 0;

  // 3. Payments captured in period
  const paymentsAgg = await prisma.payment.aggregate({
    where: {
      organizationId: input.organizationId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      status: "captured",
      createdAt: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  const totalRevenueDecimal = paymentsAgg._sum.amount ?? new Prisma.Decimal(0);

  // 4. Outstanding invoice balances (issued or overdue)
  const outstandingAgg = await prisma.invoice.aggregate({
    where: {
      organizationId: input.organizationId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      status: { in: ["issued", "overdue"] },
    },
    _sum: { total: true },
  });
  const outstandingDecimal = outstandingAgg._sum.total ?? new Prisma.Decimal(0);

  // 5. Cancellations, No-shows, Arrivals, Departures within period
  const reservationsInPeriod = await prisma.reservation.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      OR: [
        { checkIn: { gte: start, lte: end } },
        { checkOut: { gte: start, lte: end } },
        { cancelledAt: { gte: start, lte: end } },
      ],
    },
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      cancelledAt: true,
    },
  });

  let cancellationsCount = 0;
  let noShowsCount = 0;
  let arrivalsCount = 0;
  let departuresCount = 0;

  for (const res of reservationsInPeriod) {
    if (res.status === "cancelled" && res.cancelledAt && res.cancelledAt >= start && res.cancelledAt <= end) {
      cancellationsCount++;
    }
    if (res.status === "no_show") {
      noShowsCount++;
    }
    if (res.checkIn >= start && res.checkIn <= end && res.status !== "cancelled") {
      arrivalsCount++;
    }
    if (res.checkOut >= start && res.checkOut <= end && res.status !== "cancelled") {
      departuresCount++;
    }
  }

  // 6. Day-by-day trend breakdown
  const dailyMap = new Map<string, { roomsSold: number; revenue: Prisma.Decimal }>();
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { roomsSold: 0, revenue: new Prisma.Decimal(0) });
  }

  for (const rn of roomNights) {
    const key = rn.date.toISOString().split("T")[0];
    const entry = dailyMap.get(key);
    if (entry) {
      entry.roomsSold++;
      entry.revenue = entry.revenue.plus(rn.price);
    }
  }

  const dailyBreakdown = Array.from(dailyMap.entries()).map(([dateStr, data]) => {
    const daySold = data.roomsSold;
    const dayRev = data.revenue;
    const dayOcc = totalRooms > 0 ? Math.round((daySold / totalRooms) * 10000) / 100 : 0;
    const dayAdr = daySold > 0
      ? dayRev.dividedBy(daySold).toFixed(2)
      : "0.00";
    const dayRevpar = totalRooms > 0
      ? dayRev.dividedBy(totalRooms).toFixed(2)
      : "0.00";

    return {
      date: dateStr,
      roomsSold: daySold,
      roomRevenue: dayRev.toFixed(2),
      occupancyRate: dayOcc,
      adr: dayAdr,
      revpar: dayRevpar,
    };
  });

  return {
    period: {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      daysCount: days,
    },
    totalRooms,
    roomsAvailableInPeriod,
    roomsSold,
    occupancyRate,
    roomRevenue: roomRevenueDecimal,
    totalRevenue: totalRevenueDecimal,
    adr: adrDecimal,
    revpar: revparDecimal,
    outstandingBalance: outstandingDecimal,
    cancellationsCount,
    noShowsCount,
    arrivalsCount,
    departuresCount,
    roomStatusBreakdown,
    dailyBreakdown,
  };
}

/**
 * Escapes field for RFC 4180 CSV export.
 */
function escapeCsv(field: unknown): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 formatted CSV string for reports.
 */
export async function exportCsvReport(input: {
  organizationId: string;
  type: "financial" | "occupancy" | "reservations";
  propertyId?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
}): Promise<string> {
  const { start, end } = normalizeDateRange(input.startDate, input.endDate);

  if (input.type === "financial") {
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { name: true, currency: true } },
        reservation: {
          include: {
            guest: { select: { firstName: true, lastName: true } },
            rooms: { include: { room: { select: { number: true } } } },
          },
        },
        payments: { where: { status: "captured" } },
      },
    });

    const header = [
      "Invoice Number",
      "Date",
      "Property",
      "Guest Name",
      "Rooms",
      "Status",
      "Currency",
      "Subtotal",
      "Taxes",
      "Total Amount",
      "Amount Paid",
      "Balance Due",
    ];

    const rows = invoices.map((inv) => {
      const guestName = inv.reservation?.guest
        ? `${inv.reservation.guest.firstName} ${inv.reservation.guest.lastName}`
        : "N/A";
      const roomNumbers = inv.reservation?.rooms.map((r) => r.room.number).join("; ") || "Unassigned";
      const totalPaid = inv.payments.reduce((acc, p) => acc.plus(p.amount), new Prisma.Decimal(0));
      const balanceDue = Prisma.Decimal.max(new Prisma.Decimal(0), inv.total.minus(totalPaid));

      return [
        inv.number,
        inv.createdAt.toISOString().split("T")[0],
        inv.property.name,
        guestName,
        roomNumbers,
        inv.status,
        inv.property.currency,
        inv.subtotal.toFixed(2),
        inv.tax.toFixed(2),
        inv.total.toFixed(2),
        totalPaid.toFixed(2),
        balanceDue.toFixed(2),
      ].map(escapeCsv).join(",");
    });

    return [header.join(","), ...rows].join("\r\n");
  }

  if (input.type === "occupancy") {
    const summary = await getExecutiveKpis({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      startDate: start,
      endDate: end,
    });

    const header = [
      "Date",
      "Total Rooms",
      "Rooms Sold",
      "Occupancy Rate (%)",
      "Room Revenue",
      "ADR",
      "RevPAR",
    ];

    const rows = summary.dailyBreakdown.map((day) =>
      [
        day.date,
        summary.totalRooms,
        day.roomsSold,
        day.occupancyRate.toFixed(2),
        day.roomRevenue,
        day.adr,
        day.revpar,
      ]
        .map(escapeCsv)
        .join(","),
    );

    return [header.join(","), ...rows].join("\r\n");
  }

  if (input.type === "reservations") {
    const reservations = await prisma.reservation.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { name: true, currency: true } },
        guest: true,
        rooms: { include: { room: { select: { number: true } } } },
      },
    });

    const header = [
      "Confirmation Code",
      "Created Date",
      "Property",
      "Guest First Name",
      "Guest Last Name",
      "Guest Email",
      "Guest Phone",
      "Check-In",
      "Check-Out",
      "Nights",
      "Adults",
      "Children",
      "Rooms",
      "Status",
      "Source",
      "Currency",
      "Total Amount",
    ];

    const rows = reservations.map((res) => {
      const ms = new Date(res.checkOut).getTime() - new Date(res.checkIn).getTime();
      const nights = Math.max(0, Math.round(ms / 86400000));
      const roomNumbers = res.rooms.map((r) => r.room.number).join("; ") || "Unassigned";

      return [
        res.code,
        res.createdAt.toISOString().split("T")[0],
        res.property.name,
        res.guest?.firstName ?? "",
        res.guest?.lastName ?? "",
        res.guest?.email ?? "",
        res.guest?.phone ?? "",
        res.checkIn.toISOString().split("T")[0],
        res.checkOut.toISOString().split("T")[0],
        nights,
        res.adults,
        res.children,
        roomNumbers,
        res.status,
        res.source,
        res.currency,
        res.totalAmount.toFixed(2),
      ].map(escapeCsv).join(",");
    });

    return [header.join(","), ...rows].join("\r\n");
  }

  throw new Error(`Unsupported report type: ${input.type}`);
}
