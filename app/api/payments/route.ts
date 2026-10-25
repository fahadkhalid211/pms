import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";

export async function GET(_request: Request) {
  try {
    const user = await requirePermission("billing.view");
    const where = { organizationId: user.organizationId ?? "" };
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { invoice: { select: { number: true, total: true } } },
    });
    const totals = await prisma.payment.aggregate({
      where: { organizationId: user.organizationId ?? "" },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return NextResponse.json({ success: true, data: { payments, totals } });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load payments" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("billing.manage");
    const body = (await request.json()) as {
      propertyId?: string;
      invoiceId?: string;
      reservationId?: string;
      amount?: number;
      currency?: string;
      status?: string;
      method?: string;
      provider?: string;
      providerRef?: string;
    };
    const payment = await prisma.payment.create({
      data: {
        organizationId: user.organizationId ?? "",
        propertyId: body.propertyId,
        invoiceId: body.invoiceId,
        reservationId: body.reservationId,
        amount: body.amount ?? 0,
        currency: body.currency ?? "USD",
        status: body.status ?? "captured",
        method: body.method ?? "card",
        provider: body.provider,
        providerRef: body.providerRef,
        capturedAt: body.status === "captured" ? new Date() : undefined,
      },
    });
    if (body.status === "captured" && body.invoiceId) {
      const invoice = await prisma.invoice.update({
        where: { id: body.invoiceId },
        data: { status: "paid" },
      });
      await auditLog({
        userId: user.id,
        organizationId: user.organizationId ?? undefined,
        propertyId: body.propertyId,
        action: "payment.captured",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { amount: Number(payment.amount), invoice: invoice.number },
      });
    }
    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to create payment" } }, { status: 500 });
  }
}
