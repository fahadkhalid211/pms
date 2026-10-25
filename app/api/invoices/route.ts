import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

const createInvoiceSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  reservationId: z.string().optional().nullable(),
  number: z.string().optional(),
  status: z.enum(["draft", "issued", "paid", "partially_paid", "overdue", "void", "refunded"]).optional(),
  subtotal: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  currency: z.string().default("USD"),
  dueDate: z.string().datetime().optional().nullable().or(z.string().optional().nullable()),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
    unitAmount: z.number().min(0),
    total: z.number().min(0),
  })).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    const user = await requirePermission("billing.view", propertyId ? { propertyId } : undefined);

    const invoices = await dal.invoices.findMany(
      { organizationId: user.organizationId! },
      { propertyId },
    );
    return NextResponse.json({ success: true, data: invoices });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load invoices" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = createInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid invoice payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("billing.manage", { propertyId: parsed.data.propertyId });
    const invoice = await dal.invoices.create(
      { organizationId: user.organizationId! },
      {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    );

    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      propertyId: parsed.data.propertyId,
      action: "invoice.created",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: { number: invoice.number, total: Number(invoice.total) },
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create invoice" } }, { status });
  }
}
