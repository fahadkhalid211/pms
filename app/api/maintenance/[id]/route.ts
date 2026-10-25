import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const updateMaintenanceSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "emergency"]).optional(),
  assigneeId: z.string().optional().nullable(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("maintenance.view");
    const ticket = await dal.maintenance.findUnique({ organizationId: user.organizationId! }, id);
    return NextResponse.json({ success: true, data: ticket });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Ticket not found" } }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("maintenance.manage");
    const rawBody = await request.json();
    const parsed = updateMaintenanceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid maintenance update payload" } },
        { status: 400 },
      );
    }

    const updated = await dal.maintenance.update(
      { organizationId: user.organizationId! },
      id,
      {
        status: parsed.data.status,
        priority: parsed.data.priority,
        assigneeId: parsed.data.assigneeId ?? undefined,
      },
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update ticket" } }, { status });
  }
}
