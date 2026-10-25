import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const updateInvoiceSchema = z.object({
  status: z.enum(["draft", "issued", "paid", "partially_paid", "overdue", "void", "refunded"]).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("billing.view");
    const invoice = await dal.invoices.findUnique({ organizationId: user.organizationId! }, id);
    return NextResponse.json({ success: true, data: { invoice, lineItems: invoice.lineItems, payments: invoice.payments } });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Invoice not found" } }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("billing.manage");
    const rawBody = await request.json();
    const parsed = updateInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid invoice update payload" } },
        { status: 400 },
      );
    }

    const updated = await dal.invoices.update(
      { organizationId: user.organizationId! },
      id,
      { status: parsed.data.status },
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update invoice" } }, { status });
  }
}
