import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const createMaintenanceSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  roomId: z.string().optional().nullable(),
  status: z.enum(["open", "in_progress", "resolved", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "emergency"]).optional(),
  description: z.string().trim().min(1, "Description is required"),
  assigneeId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    const user = await requirePermission("maintenance.view", propertyId ? { propertyId } : undefined);

    const tickets = await dal.maintenance.findMany(
      { organizationId: user.organizationId! },
      propertyId,
    );
    return NextResponse.json({ success: true, data: tickets });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load tickets" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = createMaintenanceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid maintenance payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("maintenance.manage", { propertyId: parsed.data.propertyId });
    const ticket = await dal.maintenance.create(
      { organizationId: user.organizationId! },
      {
        propertyId: parsed.data.propertyId,
        roomId: parsed.data.roomId ?? undefined,
        status: parsed.data.status,
        priority: parsed.data.priority,
        description: parsed.data.description,
        assigneeId: parsed.data.assigneeId ?? undefined,
      },
    );
    return NextResponse.json({ success: true, data: ticket }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create ticket" } }, { status });
  }
}
