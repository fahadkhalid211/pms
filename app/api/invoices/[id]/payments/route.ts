import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const invoicePaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  method: z.string().default("card"),
  provider: z.string().optional().nullable(),
  providerRef: z.string().optional().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rawBody = await request.json();
    const parsed = invoicePaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid payment payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("billing.manage");

    const payment = await dal.payments.create(
      { organizationId: user.organizationId! },
      {
        invoiceId: id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        provider: parsed.data.provider ?? "manual",
        providerRef: parsed.data.providerRef ?? undefined,
        status: "captured",
      },
      user.id,
    );

    const updatedFolio = await dal.invoices.getFolio({ organizationId: user.organizationId! }, id);

    return NextResponse.json(
      {
        success: true,
        data: {
          payment,
          invoice: updatedFolio,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to record payment" } },
      { status },
    );
  }
}
