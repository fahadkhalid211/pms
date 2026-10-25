import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import type { InvoiceStatus } from "@prisma/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("billing.view");
    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: user.organizationId ?? "" },
    });
    if (!invoice) return NextResponse.json({ success: false, error: { message: "Invoice not found." } }, { status: 404 });
    const lineItems = await prisma.invoiceLineItem.findMany({ where: { invoiceId: id } });
    const payments = await prisma.payment.findMany({ where: { invoiceId: id } });
    return NextResponse.json({ success: true, data: { invoice, lineItems, payments } });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load invoice" } }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("billing.manage");
    const { id } = await params;
    const existing = await prisma.invoice.findFirst({
      where: { id, organizationId: user.organizationId ?? "" },
    });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Invoice not found." } }, { status: 404 });

    const body = (await request.json()) as { status?: string };
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: typeof body.status === "string" ? (body.status as InvoiceStatus) : undefined },
    });
    return NextResponse.json({ success: true, data: invoice });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to update invoice" } }, { status: 500 });
  }
}
