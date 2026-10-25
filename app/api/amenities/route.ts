import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

const CreateAmenitySchema = z.object({
  name: z.string().min(1, "Amenity name is required"),
  category: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
});

const RoomAmenityActionSchema = z.object({
  action: z.enum(["assign", "unassign"]),
  roomId: z.string().min(1, "roomId is required"),
  amenityId: z.string().min(1, "amenityId is required"),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("rooms.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;

    const amenities = await dal.amenities.findMany({ organizationId: user.organizationId }, propertyId);
    return NextResponse.json({ success: true, data: amenities });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch amenities" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("rooms.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CreateAmenitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    const amenity = await dal.amenities.create(
      { organizationId: user.organizationId },
      parsed.data,
    );

    return NextResponse.json({ success: true, data: amenity }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create amenity" } }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requirePermission("rooms.manage", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = RoomAmenityActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Validation error", errors: parsed.error.flatten() } }, { status: 400 });
    }

    if (parsed.data.action === "assign") {
      const res = await dal.amenities.assignToRoom(
        { organizationId: user.organizationId },
        parsed.data.roomId,
        parsed.data.amenityId,
      );
      return NextResponse.json({ success: true, data: res });
    } else {
      await dal.amenities.removeFromRoom(
        { organizationId: user.organizationId },
        parsed.data.roomId,
        parsed.data.amenityId,
      );
      return NextResponse.json({ success: true, message: "Amenity removed from room" });
    }
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update room amenity" } }, { status });
  }
}
