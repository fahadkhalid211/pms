import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreateRoomTypeSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  name: z.string().min(1, "Room type name is required"),
  capacity: z.coerce.number().int().min(1).optional().default(2),
  sizeSqm: z.coerce.number().int().min(1).optional().nullable(),
  bedType: z.string().optional().default("King"),
  baseRate: z.union([z.string(), z.number()]).refine((val) => Number(val) >= 0, "baseRate must be non-negative"),
  depositType: z.string().optional().default("none"),
  depositAmount: z.union([z.string(), z.number()]).optional().default(0),
  cancellationPolicy: z.any().optional(),
  status: z.string().optional().default("active"),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("rooms.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;

    const roomTypes = await dal.roomTypes.findMany(
      { organizationId: user.organizationId },
      propertyId,
    );

    return NextResponse.json({ success: true, data: roomTypes });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch room types" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("rooms.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CreateRoomTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const roomType = await dal.roomTypes.create(
      { organizationId: user.organizationId },
      {
        propertyId: parsed.data.propertyId,
        name: parsed.data.name,
        capacity: parsed.data.capacity,
        sizeSqm: parsed.data.sizeSqm,
        bedType: parsed.data.bedType,
        baseRate: parsed.data.baseRate,
        depositType: parsed.data.depositType,
        depositAmount: parsed.data.depositAmount,
        cancellationPolicy: parsed.data.cancellationPolicy,
        status: parsed.data.status,
      },
    );

    return NextResponse.json({ success: true, data: roomType }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create room type" } }, { status });
  }
}
