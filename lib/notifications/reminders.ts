import { prisma } from "@/lib/db";
import { enqueueNotification, TenantContext } from "./queue";

// ---------------------------------------------------------------------------
// 1. Pre-Arrival Reminders (24h - 72h before check-in)
// ---------------------------------------------------------------------------
export async function runPreArrivalReminders(ctx: TenantContext) {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours
  const windowEnd = new Date(now.getTime() + 72 * 60 * 60 * 1000); // +72 hours

  const upcomingReservations = await prisma.reservation.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "confirmed",
      checkIn: {
        gte: windowStart,
        lte: windowEnd,
      },
      guest: { isNot: null },
    },
    include: {
      guest: true,
      property: true,
      rooms: { include: { room: { include: { roomType: true } } } },
    },
  });

  const triggeredIds: string[] = [];

  for (const res of upcomingReservations) {
    if (!res.guest?.email) continue;

    // Deduplication check: Has a pre_arrival notification already been queued/sent for this reservation?
    const existing = await prisma.notification.findFirst({
      where: {
        organizationId: ctx.organizationId,
        relatedType: "Reservation",
        relatedId: res.id,
        type: "pre_arrival",
      },
    });

    if (existing) continue;

    const roomType = res.rooms?.[0]?.room?.roomType?.name || "Standard Room";

    await enqueueNotification(ctx, {
      organizationId: ctx.organizationId,
      propertyId: res.propertyId,
      guestId: res.guestId,
      channel: "email",
      type: "pre_arrival",
      templateCode: "pre_arrival",
      toEmail: res.guest.email,
      relatedType: "Reservation",
      relatedId: res.id,
      variables: {
        guestName: `${res.guest.firstName} ${res.guest.lastName}`,
        propertyName: res.property.name,
        bookingCode: res.code,
        checkInDate: new Date(res.checkIn).toLocaleDateString(),
        checkOutDate: new Date(res.checkOut).toLocaleDateString(),
        roomType,
      },
    });

    triggeredIds.push(res.id);
  }

  return { triggered: triggeredIds.length, reservationIds: triggeredIds };
}

// ---------------------------------------------------------------------------
// 2. Check-in Welcome Reminders
// ---------------------------------------------------------------------------
export async function runCheckInReminders(ctx: TenantContext) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const activeCheckIns = await prisma.reservation.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "checked_in",
      updatedAt: { gte: dayAgo },
      guest: { isNot: null },
    },
    include: {
      guest: true,
      property: true,
      rooms: { include: { room: true } },
    },
  });

  const triggeredIds: string[] = [];

  for (const res of activeCheckIns) {
    if (!res.guest?.email) continue;

    const existing = await prisma.notification.findFirst({
      where: {
        organizationId: ctx.organizationId,
        relatedType: "Reservation",
        relatedId: res.id,
        type: "check_in_welcome",
      },
    });

    if (existing) continue;

    const roomNumber = res.rooms?.[0]?.room?.number || "Your Room";

    await enqueueNotification(ctx, {
      organizationId: ctx.organizationId,
      propertyId: res.propertyId,
      guestId: res.guestId,
      channel: "email",
      type: "check_in_welcome",
      templateCode: "check_in_welcome",
      toEmail: res.guest.email,
      relatedType: "Reservation",
      relatedId: res.id,
      variables: {
        guestName: `${res.guest.firstName} ${res.guest.lastName}`,
        propertyName: res.property.name,
        roomNumber,
        wifiSsid: `${res.property.code}-Guest`,
        wifiPassword: "WelcomeLumina!",
        checkOutDate: new Date(res.checkOut).toLocaleDateString(),
      },
    });

    triggeredIds.push(res.id);
  }

  return { triggered: triggeredIds.length, reservationIds: triggeredIds };
}

// ---------------------------------------------------------------------------
// 3. Checkout Thanks Reminders
// ---------------------------------------------------------------------------
export async function runCheckOutReminders(ctx: TenantContext) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const checkouts = await prisma.reservation.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "checked_out",
      updatedAt: { gte: dayAgo },
      guest: { isNot: null },
    },
    include: {
      guest: true,
      property: true,
      invoices: {
        include: { payments: true },
      },
    },
  });

  const triggeredIds: string[] = [];

  for (const res of checkouts) {
    if (!res.guest?.email) continue;

    const existing = await prisma.notification.findFirst({
      where: {
        organizationId: ctx.organizationId,
        relatedType: "Reservation",
        relatedId: res.id,
        type: "check_out_thanks",
      },
    });

    if (existing) continue;

    const invoice = res.invoices?.[0];
    const totalAmount = invoice ? Number(invoice.total).toFixed(2) : Number(res.totalAmount).toFixed(2);
    const paid = (invoice?.payments ?? [])
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = Math.max(0, Number(totalAmount) - paid).toFixed(2);

    await enqueueNotification(ctx, {
      organizationId: ctx.organizationId,
      propertyId: res.propertyId,
      guestId: res.guestId,
      channel: "email",
      type: "check_out_thanks",
      templateCode: "check_out_thanks",
      toEmail: res.guest.email,
      relatedType: "Reservation",
      relatedId: res.id,
      variables: {
        guestName: `${res.guest.firstName} ${res.guest.lastName}`,
        propertyName: res.property.name,
        bookingCode: res.code,
        totalAmount,
        balanceDue,
      },
    });

    triggeredIds.push(res.id);
  }

  return { triggered: triggeredIds.length, reservationIds: triggeredIds };
}

// ---------------------------------------------------------------------------
// 4. Overdue Payment Reminders
// ---------------------------------------------------------------------------
export async function runPaymentReminders(ctx: TenantContext) {
  const now = new Date();

  const dueInvoices = await prisma.invoice.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { in: ["issued", "overdue", "partially_paid"] },
      dueDate: { lte: now },
    },
    include: {
      property: true,
      reservation: { include: { guest: true } },
      payments: true,
    },
  });

  const triggeredIds: string[] = [];

  for (const inv of dueInvoices) {
    const guestEmail = inv.reservation?.guest?.email;
    if (!guestEmail) continue;

    // Check if reminder was sent in the last 48 hours to prevent spamming
    const recentReminder = await prisma.notification.findFirst({
      where: {
        organizationId: ctx.organizationId,
        relatedType: "Invoice",
        relatedId: inv.id,
        type: "payment_reminder",
        createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
    });

    if (recentReminder) continue;

    const paid = inv.payments
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = Math.max(0, Number(inv.total) - paid).toFixed(2);

    if (parseFloat(balanceDue) <= 0) continue;

    const guestName = inv.reservation?.guest
      ? `${inv.reservation.guest.firstName} ${inv.reservation.guest.lastName}`
      : "Guest";

    await enqueueNotification(ctx, {
      organizationId: ctx.organizationId,
      propertyId: inv.propertyId,
      guestId: inv.reservation?.guestId,
      channel: "email",
      type: "payment_reminder",
      templateCode: "payment_reminder",
      toEmail: guestEmail,
      relatedType: "Invoice",
      relatedId: inv.id,
      variables: {
        guestName,
        propertyName: inv.property.name,
        invoiceNumber: inv.number,
        balanceDue,
        dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "Immediately",
      },
    });

    triggeredIds.push(inv.id);
  }

  return { triggered: triggeredIds.length, invoiceIds: triggeredIds };
}
