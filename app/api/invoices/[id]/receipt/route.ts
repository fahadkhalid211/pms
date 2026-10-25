import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("billing.view");
    const folio = await dal.invoices.getFolio({ organizationId: user.organizationId! }, id);

    return NextResponse.json({
      success: true,
      data: {
        ...folio,
        receiptNumber: `REC-${folio.number}`,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to retrieve invoice receipt" } },
      { status },
    );
  }
}
