import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const UpdateRoomTypeSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  sizeSqm: z.coerce.number().int().min(1).optional().nullable(),
  bedType: z.string().optional(),
  baseRate: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0).optional(),
  depositType: z.string().optional(),
  depositAmount: z.union([z.string(), z.number()]).optional(),
  cancellationPolicy: z.any().optional(),
  status: z.string().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("rooms.view");
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const roomType = await dal.roomTypes.findUnique({ organizationId: user.organizationId }, id);
    return NextResponse.json({ success: true, data: roomType });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch room type" } }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("rooms.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateRoomTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const updated = await dal.roomTypes.update({ organizationId: user.organizationId }, id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update room type" } }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission("rooms.manage");
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    await dal.roomTypes.delete({ organizationId: user.organizationId }, id);
    return NextResponse.json({ success: true, message: "Room type deleted successfully" });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to delete room type" } }, { status });
  }
}
