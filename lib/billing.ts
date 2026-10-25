import crypto from "node:crypto";
import { Prisma, InvoiceStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import {
  NotFoundError,
  CrossTenantViolationError,
  InvalidPaymentAmountError,
  InvoiceAlreadySettledError,
  OverpaymentNotAllowedError,
  InvalidRefundStateError,
  RefundExceedsPaymentError,
} from "@/lib/errors";

export interface TenantContext {
  organizationId: string;
  propertyId?: string | null;
}

export interface GenerateInvoiceFromReservationInput {
  reservationId: string;
  dueDate?: Date | null;
  notes?: string | null;
  userId?: string;
}

export interface RecordPaymentInput {
  invoiceId?: string;
  reservationId?: string;
  propertyId?: string;
  amount: Prisma.Decimal | string | number;
  currency?: string;
  method?: string;
  provider?: string;
  providerRef?: string;
  status?: PaymentStatus;
  userId?: string;
}

export interface RequestRefundInput {
  paymentId: string;
  amount: Prisma.Decimal | string | number;
  reason?: string;
  userId?: string;
}

export interface ApproveRefundInput {
  refundId: string;
  approvedByUserId: string;
  gatewayRef?: string;
}

// ---------------------------------------------------------------------------
// Invoice Number Generator: INV-YYYYMM-XXXX
// ---------------------------------------------------------------------------
export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INV-${year}${month}-${randomSuffix}`;
}

// ---------------------------------------------------------------------------
// 1. Generate Server-Side Invoice from Reservation
// ---------------------------------------------------------------------------
export async function generateInvoiceFromReservation(
  ctx: TenantContext,
  input: GenerateInvoiceFromReservationInput,
) {
  // 1. Load reservation with relations
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: input.reservationId,
      organizationId: ctx.organizationId,
    },
    include: {
      property: true,
      guest: true,
      rooms: {
        include: {
          room: {
            include: {
              roomType: true,
            },
          },
        },
      },
      roomNights: {
        orderBy: { date: "asc" },
      },
      invoices: {
        where: { status: { not: "void" } },
        include: { lineItems: true, payments: true },
      },
    },
  });

  if (!reservation) {
    const crossTenant = await prisma.reservation.findUnique({ where: { id: input.reservationId } });
    if (crossTenant) {
      throw new CrossTenantViolationError("Reservation does not belong to your organization.");
    }
    throw new NotFoundError("Reservation not found.");
  }

  // Idempotency check: if an active invoice already exists for this reservation, return it
  if (reservation.invoices.length > 0) {
    return reservation.invoices[0];
  }

  const property = reservation.property;

  // 2. Compute itemized line items with exact Decimal precision
  type LineItemDraft = {
    description: string;
    quantity: number;
    unitAmount: Prisma.Decimal;
    total: Prisma.Decimal;
  };

  const lineItems: LineItemDraft[] = [];
  let subtotal = new Prisma.Decimal(0);

  // Room night line items: group by room
  for (const resRoom of reservation.rooms) {
    const room = resRoom.room;
    const roomNights = reservation.roomNights.filter((rn) => rn.roomId === room.id);

    if (roomNights.length > 0) {
      const roomTotal = roomNights.reduce(
        (sum, n) => sum.plus(new Prisma.Decimal(n.price)),
        new Prisma.Decimal(0),
      );

      const qty = roomNights.length;
      const unit = roomTotal.dividedBy(qty).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      lineItems.push({
        description: `Room ${room.number} (${room.roomType.name}) - ${qty} night(s) stay`,
        quantity: qty,
        unitAmount: unit,
        total: roomTotal,
      });

      subtotal = subtotal.plus(roomTotal);
    } else {
      // Fallback to reservationRoom nightlyRate if roomNights were not populated
      const checkInDate = new Date(reservation.checkIn);
      const checkOutDate = new Date(reservation.checkOut);
      const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      const rate = new Prisma.Decimal(resRoom.nightlyRate);
      const total = rate.times(nights);

      lineItems.push({
        description: `Room ${room.number} (${room.roomType.name}) - ${nights} night(s) stay`,
        quantity: nights,
        unitAmount: rate,
        total,
      });

      subtotal = subtotal.plus(total);
    }
  }

  // Cleaning fee line item
  if (property.cleaningFee && new Prisma.Decimal(property.cleaningFee).greaterThan(0)) {
    const fee = new Prisma.Decimal(property.cleaningFee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    lineItems.push({
      description: `Cleaning Fee (${property.name})`,
      quantity: 1,
      unitAmount: fee,
      total: fee,
    });
    subtotal = subtotal.plus(fee);
  }

  // Tax calculation
  let tax = new Prisma.Decimal(0);
  if (property.taxRate && new Prisma.Decimal(property.taxRate).greaterThan(0)) {
    const taxRatePercent = new Prisma.Decimal(property.taxRate);
    tax = subtotal.times(taxRatePercent).dividedBy(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  const discount = new Prisma.Decimal(0);
  const total = subtotal.plus(tax).minus(discount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const invoiceNumber = generateInvoiceNumber();

  // 3. Atomically persist Invoice & Line Items
  const invoice = await prisma.$transaction(async (tx) => {
    return tx.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        propertyId: reservation.propertyId,
        reservationId: reservation.id,
        number: invoiceNumber,
        status: "issued",
        issueDate: new Date(),
        dueDate: input.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days net
        subtotal,
        discount,
        tax,
        total,
        currency: reservation.currency || property.currency || "USD",
        notes: input.notes ?? `Folio for reservation ${reservation.code} - Guest: ${reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : "Walk-in"}`,
        lineItems: {
          create: lineItems.map((item) => ({
            organizationId: ctx.organizationId,
            description: item.description,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            total: item.total,
          })),
        },
      },
      include: {
        lineItems: true,
        payments: true,
        reservation: {
          select: { code: true },
        },
        property: {
          select: { name: true, currency: true },
        },
      },
    });
  });

  if (input.userId) {
    await auditLog({
      userId: input.userId,
      organizationId: ctx.organizationId,
      propertyId: reservation.propertyId,
      action: "invoice.generated",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        number: invoice.number,
        reservationId: reservation.id,
        code: reservation.code,
        total: invoice.total.toString(),
      },
    });
  }

  return invoice;
}

// ---------------------------------------------------------------------------
// 2. Invoice Status Reconciliation Function
// ---------------------------------------------------------------------------
export async function recalculateInvoiceStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  organizationId: string,
): Promise<{ status: InvoiceStatus; total: Prisma.Decimal; netPaid: Prisma.Decimal; balance: Prisma.Decimal }> {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      payments: {
        include: {
          refunds: true,
        },
      },
    },
  });

  if (!invoice) {
    const crossTenant = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (crossTenant) {
      throw new CrossTenantViolationError("Invoice does not belong to your organization.");
    }
    throw new NotFoundError("Invoice not found.");
  }

  // Sum captured payments
  let totalCaptured = new Prisma.Decimal(0);
  let totalRefunded = new Prisma.Decimal(0);

  for (const payment of invoice.payments) {
    if (payment.status === "captured" || payment.status === "partially_refunded" || payment.status === "refunded") {
      totalCaptured = totalCaptured.plus(new Prisma.Decimal(payment.amount));
    }
    for (const refund of payment.refunds) {
      if (refund.status === "succeeded") {
        totalRefunded = totalRefunded.plus(new Prisma.Decimal(refund.amount));
      }
    }
  }

  const netPaid = totalCaptured.minus(totalRefunded);
  const balance = new Prisma.Decimal(invoice.total).minus(netPaid);

  let newStatus: InvoiceStatus = invoice.status;

  if (totalRefunded.greaterThanOrEqualTo(totalCaptured) && totalCaptured.greaterThan(0)) {
    newStatus = "refunded";
  } else if (balance.lessThanOrEqualTo(0) && new Prisma.Decimal(invoice.total).greaterThan(0)) {
    newStatus = "paid";
  } else if (netPaid.greaterThan(0)) {
    newStatus = "partially_paid";
  } else if (invoice.status === "paid" || invoice.status === "partially_paid") {
    // If payments were voided or fully refunded, revert to issued or overdue
    newStatus = invoice.dueDate && new Date() > invoice.dueDate ? "overdue" : "issued";
  }

  if (newStatus !== invoice.status) {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: newStatus },
    });
  }

  return { status: newStatus, total: new Prisma.Decimal(invoice.total), netPaid, balance };
}

// ---------------------------------------------------------------------------
// 3. Record Payment & Reconcile Balances
// ---------------------------------------------------------------------------
export async function recordPayment(ctx: TenantContext, input: RecordPaymentInput) {
  const amountDec = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (amountDec.lessThanOrEqualTo(0)) {
    throw new InvalidPaymentAmountError("Payment amount must be greater than zero.");
  }

  const paymentStatus = input.status ?? "captured";

  const result = await prisma.$transaction(async (tx) => {
    let resolvedPropertyId = input.propertyId;
    let resolvedReservationId = input.reservationId;
    let currency = input.currency ?? "USD";

    if (input.invoiceId) {
      const invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
        include: {
          payments: {
            include: { refunds: true },
          },
        },
      });

      if (!invoice) {
        const crossTenant = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
        if (crossTenant) {
          throw new CrossTenantViolationError("Invoice does not belong to your organization.");
        }
        throw new NotFoundError("Invoice not found.");
      }

      resolvedPropertyId = invoice.propertyId;
      resolvedReservationId = invoice.reservationId ?? undefined;
      currency = invoice.currency;

      // Compute current net paid
      let currentCaptured = new Prisma.Decimal(0);
      let currentRefunded = new Prisma.Decimal(0);

      for (const p of invoice.payments) {
        if (p.status === "captured" || p.status === "partially_refunded" || p.status === "refunded") {
          currentCaptured = currentCaptured.plus(new Prisma.Decimal(p.amount));
        }
        for (const r of p.refunds) {
          if (r.status === "succeeded") {
            currentRefunded = currentRefunded.plus(new Prisma.Decimal(r.amount));
          }
        }
      }

      const netPaid = currentCaptured.minus(currentRefunded);
      const remainingBalance = new Prisma.Decimal(invoice.total).minus(netPaid);

      if (remainingBalance.lessThanOrEqualTo(0)) {
        throw new InvoiceAlreadySettledError("Invoice is already fully paid. No outstanding balance remains.");
      }

      if (paymentStatus === "captured" && amountDec.greaterThan(remainingBalance)) {
        throw new OverpaymentNotAllowedError(
          `Payment amount (${amountDec.toFixed(2)}) exceeds remaining balance (${remainingBalance.toFixed(2)}).`,
        );
      }
    }

    // Create payment record
    const payment = await tx.payment.create({
      data: {
        organizationId: ctx.organizationId,
        propertyId: resolvedPropertyId,
        invoiceId: input.invoiceId,
        reservationId: resolvedReservationId,
        amount: amountDec,
        currency,
        status: paymentStatus,
        method: input.method ?? "card",
        provider: input.provider ?? "manual",
        providerRef: input.providerRef ?? null,
        capturedAt: paymentStatus === "captured" ? new Date() : null,
      },
    });

    let reconciliation: { status: InvoiceStatus; total: Prisma.Decimal; netPaid: Prisma.Decimal; balance: Prisma.Decimal } | null = null;

    if (input.invoiceId) {
      reconciliation = await recalculateInvoiceStatus(tx, input.invoiceId, ctx.organizationId);
    }

    return { payment, reconciliation };
  });

  if (input.userId) {
    await auditLog({
      userId: input.userId,
      organizationId: ctx.organizationId,
      propertyId: result.payment.propertyId ?? undefined,
      action: "payment.recorded",
      entityType: "Payment",
      entityId: result.payment.id,
      metadata: {
        amount: result.payment.amount.toString(),
        currency: result.payment.currency,
        status: result.payment.status,
        invoiceId: result.payment.invoiceId ?? undefined,
        method: result.payment.method,
      },
    });
  }

  // Create in-app notification if invoice status reached paid
  if (result.reconciliation?.status === "paid" && input.invoiceId) {
    await createNotification({
      organizationId: ctx.organizationId,
      propertyId: result.payment.propertyId ?? undefined,
      type: "invoice.settled",
      channel: "in_app",
      payload: {
        title: "Invoice Settled",
        message: `Invoice has been fully settled ($${result.payment.amount.toString()} ${result.payment.currency}).`,
        invoiceId: input.invoiceId,
      },
    });
  }

  return result.payment;
}

// ---------------------------------------------------------------------------
// 4. Request Refund (Workflow: Created in 'pending' status)
// ---------------------------------------------------------------------------
export async function requestRefund(ctx: TenantContext, input: RequestRefundInput) {
  const refundAmount = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (refundAmount.lessThanOrEqualTo(0)) {
    throw new InvalidPaymentAmountError("Refund amount must be greater than zero.");
  }

  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, organizationId: ctx.organizationId },
    include: { refunds: true },
  });

  if (!payment) {
    const crossTenant = await prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (crossTenant) {
      throw new CrossTenantViolationError("Payment does not belong to your organization.");
    }
    throw new NotFoundError("Payment not found.");
  }

  if (payment.status !== "captured" && payment.status !== "partially_refunded") {
    throw new InvalidRefundStateError(`Cannot refund payment in '${payment.status}' status. Only captured payments can be refunded.`);
  }

  // Calculate already refunded and pending amounts
  const alreadyAllocated = payment.refunds
    .filter((r) => r.status === "succeeded" || r.status === "pending")
    .reduce((sum, r) => sum.plus(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0));

  const maxRefundable = new Prisma.Decimal(payment.amount).minus(alreadyAllocated);

  if (refundAmount.greaterThan(maxRefundable)) {
    throw new RefundExceedsPaymentError(
      `Refund amount ($${refundAmount.toFixed(2)}) exceeds maximum refundable balance ($${maxRefundable.toFixed(2)}).`,
    );
  }

  const refund = await prisma.refund.create({
    data: {
      organizationId: ctx.organizationId,
      paymentId: payment.id,
      amount: refundAmount,
      currency: payment.currency,
      status: "pending",
      reason: input.reason ?? null,
    },
  });

  if (input.userId) {
    await auditLog({
      userId: input.userId,
      organizationId: ctx.organizationId,
      propertyId: payment.propertyId ?? undefined,
      action: "refund.requested",
      entityType: "Refund",
      entityId: refund.id,
      metadata: {
        paymentId: payment.id,
        amount: refund.amount.toString(),
        currency: refund.currency,
        reason: refund.reason,
      },
    });
  }

  return refund;
}

// ---------------------------------------------------------------------------
// 5. Approve Refund (Manager Approval Lifecycle)
// ---------------------------------------------------------------------------
export async function approveRefund(ctx: TenantContext, input: ApproveRefundInput) {
  const result = await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findFirst({
      where: { id: input.refundId, organizationId: ctx.organizationId },
      include: {
        payment: {
          include: {
            refunds: true,
            invoice: true,
          },
        },
      },
    });

    if (!refund) {
      const crossTenant = await tx.refund.findUnique({ where: { id: input.refundId } });
      if (crossTenant) {
        throw new CrossTenantViolationError("Refund does not belong to your organization.");
      }
      throw new NotFoundError("Refund not found.");
    }

    if (refund.status !== "pending") {
      throw new InvalidRefundStateError(`Refund is already in '${refund.status}' status and cannot be approved.`);
    }

    const payment = refund.payment;
    const providerRef = input.gatewayRef ?? refund.providerRef ?? `re_appr_${crypto.randomUUID().slice(0, 8)}`;

    // 1. Transition refund to succeeded
    const updatedRefund = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "succeeded",
        approvedBy: input.approvedByUserId,
        providerRef,
      },
    });

    // 2. Recalculate Payment Status
    const otherSucceeded = payment.refunds
      .filter((r) => r.id !== refund.id && r.status === "succeeded")
      .reduce((sum, r) => sum.plus(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0));

    const totalRefunded = otherSucceeded.plus(new Prisma.Decimal(refund.amount));
    const paymentAmount = new Prisma.Decimal(payment.amount);

    let newPaymentStatus: PaymentStatus = payment.status;
    if (totalRefunded.greaterThanOrEqualTo(paymentAmount)) {
      newPaymentStatus = "refunded";
    } else if (totalRefunded.greaterThan(0)) {
      newPaymentStatus = "partially_refunded";
    }

    if (newPaymentStatus !== payment.status) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: newPaymentStatus },
      });
    }

    // 3. If tied to an invoice, recalculate invoice status
    if (payment.invoiceId) {
      await recalculateInvoiceStatus(tx, payment.invoiceId, ctx.organizationId);
    }

    return updatedRefund;
  });

  await auditLog({
    userId: input.approvedByUserId,
    organizationId: ctx.organizationId,
    action: "refund.approved",
    entityType: "Refund",
    entityId: result.id,
    metadata: {
      refundId: result.id,
      amount: result.amount.toString(),
      approvedBy: input.approvedByUserId,
      providerRef: result.providerRef,
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// 6. Get Comprehensive Invoice Summary & Folio
// ---------------------------------------------------------------------------
export async function getInvoiceFolio(ctx: TenantContext, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId },
    include: {
      lineItems: { orderBy: { createdAt: "asc" } },
      payments: {
        orderBy: { createdAt: "desc" },
        include: {
          refunds: { orderBy: { createdAt: "desc" } },
        },
      },
      property: true,
      reservation: {
        include: {
          guest: true,
          rooms: { include: { room: { include: { roomType: true } } } },
        },
      },
    },
  });

  if (!invoice) {
    const crossTenant = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (crossTenant) {
      throw new CrossTenantViolationError("Invoice does not belong to your organization.");
    }
    throw new NotFoundError("Invoice not found.");
  }

  // Calculate balances
  let totalCaptured = new Prisma.Decimal(0);
  let totalRefunded = new Prisma.Decimal(0);

  for (const p of invoice.payments) {
    if (p.status === "captured" || p.status === "partially_refunded" || p.status === "refunded") {
      totalCaptured = totalCaptured.plus(new Prisma.Decimal(p.amount));
    }
    for (const r of p.refunds) {
      if (r.status === "succeeded") {
        totalRefunded = totalRefunded.plus(new Prisma.Decimal(r.amount));
      }
    }
  }

  const netPaid = totalCaptured.minus(totalRefunded);
  const balanceDue = new Prisma.Decimal(invoice.total).minus(netPaid);

  return {
    ...invoice,
    summary: {
      subtotal: new Prisma.Decimal(invoice.subtotal).toFixed(2),
      discount: new Prisma.Decimal(invoice.discount).toFixed(2),
      tax: new Prisma.Decimal(invoice.tax).toFixed(2),
      total: new Prisma.Decimal(invoice.total).toFixed(2),
      totalCaptured: totalCaptured.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      netPaid: netPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      isFullyPaid: balanceDue.lessThanOrEqualTo(0) && new Prisma.Decimal(invoice.total).greaterThan(0),
    },
  };
}
