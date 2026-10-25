import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const createHousekeepingTaskSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  roomId: z.string().min(1, "roomId is required"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  title: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable().or(z.string().optional().nullable()),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    const user = await requirePermission("housekeeping.view", propertyId ? { propertyId } : undefined);

    const tasks = await dal.housekeeping.findMany(
      { organizationId: user.organizationId! },
      propertyId,
    );
    return NextResponse.json({ success: true, data: tasks });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load tasks" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = createHousekeepingTaskSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid task payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("housekeeping.manage", { propertyId: parsed.data.propertyId });
    const task = await dal.housekeeping.create(
      { organizationId: user.organizationId! },
      {
        ...parsed.data,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      },
    );
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create task" } }, { status });
  }
}
