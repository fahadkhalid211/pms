import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const generateSchema = z.object({
  reservationId: z.string().min(1, "reservationId is required"),
  dueDate: z.string().datetime().optional().nullable().or(z.string().optional().nullable()),
  notes: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = generateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid generation payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("billing.manage");

    const invoice = await dal.invoices.generateFromReservation(
      { organizationId: user.organizationId! },
      {
        reservationId: parsed.data.reservationId,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        notes: parsed.data.notes ?? null,
      },
      user.id,
    );

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to generate invoice" } },
      { status },
    );
  }
}
