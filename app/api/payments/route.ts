import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

const createPaymentSchema = z.object({
  propertyId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  reservationId: z.string().optional().nullable(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  status: z.enum(["pending", "authorized", "captured", "failed", "refunded", "partially_refunded"]).optional(),
  method: z.string().default("card"),
  provider: z.string().optional().nullable(),
  providerRef: z.string().optional().nullable(),
});

export async function GET(_request: Request) {
  try {
    const user = await requirePermission("billing.view");
    const payments = await dal.payments.findMany({ organizationId: user.organizationId! });
    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load payments" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = createPaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid payment payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("billing.manage", parsed.data.propertyId ? { propertyId: parsed.data.propertyId } : undefined);
    const payment = await dal.payments.create(
      { organizationId: user.organizationId! },
      {
        propertyId: parsed.data.propertyId ?? undefined,
        invoiceId: parsed.data.invoiceId ?? undefined,
        reservationId: parsed.data.reservationId ?? undefined,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        status: parsed.data.status,
        method: parsed.data.method,
        provider: parsed.data.provider ?? undefined,
        providerRef: parsed.data.providerRef ?? undefined,
      },
    );

    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      propertyId: parsed.data.propertyId ?? undefined,
      action: "payment.captured",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { amount: parsed.data.amount, currency: payment.currency, status: payment.status },
    });

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to record payment" } }, { status });
  }
}
