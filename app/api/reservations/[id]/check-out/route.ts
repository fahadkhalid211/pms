import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal, NotFoundError, CrossTenantViolationError } from "@/lib/dal";
import { OutstandingBalanceError, InvalidOperationError } from "@/lib/operations";
import { z } from "zod";

const checkOutSchema = z.object({
  forceUnsettled: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requirePermission("frontdesk.checkout");

    const body = await request.json().catch(() => ({}));
    const parsed = checkOutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid payload", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const result = await dal.operations.checkOut(
      { organizationId: user.organizationId! },
      id,
      {
        ...parsed.data,
        staffUserId: user.id,
      },
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof OutstandingBalanceError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OUTSTANDING_BALANCE",
            message: error.message,
            balance: error.balance,
          },
        },
        { status: 422 },
      );
    }
    if (error instanceof InvalidOperationError) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_OPERATION", message: error.message } },
        { status: 400 },
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 404 });
    }
    if (error instanceof CrossTenantViolationError) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    }

    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Checkout failed" } }, { status });
  }
}
