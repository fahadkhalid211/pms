import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("billing.view");
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const status = url.searchParams.get("status");
    const where: any = { organizationId: user.organizationId ?? "" };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      take: 100,
      include: { reservation: { select: { code: true } }, property: { select: { name: true } } },
    });
    const totals = await prisma.invoice.aggregate({
      where: { organizationId: user.organizationId ?? "" },
      _sum: { total: true },
      _count: { _all: true },
    });
    return NextResponse.json({ success: true, data: { invoices, totals } });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load invoices" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("billing.manage");
    const body = await request.json();
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: user.organizationId ?? "",
        propertyId: body.propertyId,
        reservationId: body.reservationId ?? null,
        number: body.number ?? `INV-${Date.now().toString(36).toUpperCase()}`,
        status: body.status ?? "issued",
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtotal: body.subtotal ?? 0,
        discount: body.discount ?? 0,
        tax: body.tax ?? 0,
        total: body.total ?? 0,
        currency: body.currency ?? "USD",
        notes: body.notes,
      },
    });
    if (body.lineItems?.length) {
      for (const line of body.lineItems) {
        await prisma.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: line.description,
            quantity: line.quantity ?? 1,
            unitAmount: line.unitAmount ?? 0,
            total: line.total ?? 0,
          },
        });
      }
    }
    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      propertyId: body.propertyId,
      action: "invoice.created",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: { number: invoice.number, total: invoice.total },
    });
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create invoice" } }, { status: 400 });
  }
}
