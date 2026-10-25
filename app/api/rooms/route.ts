import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";
import { z } from "zod";

const createRoomSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  roomTypeId: z.string().min(1, "roomTypeId is required"),
  number: z.string().trim().min(1, "Room number is required"),
  name: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  status: z.enum(["available", "occupied", "dirty", "clean", "inspected", "out_of_service"]).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    const user = await requirePermission("rooms.view", propertyId ? { propertyId } : undefined);

    const rooms = await dal.rooms.findMany(
      { organizationId: user.organizationId! },
      propertyId,
    );
    return NextResponse.json({ success: true, data: rooms });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load rooms" } }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = createRoomSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid room payload" } },
        { status: 400 },
      );
    }

    const user = await requirePermission("rooms.manage", { propertyId: parsed.data.propertyId });
    const room = await dal.rooms.create(
      { organizationId: user.organizationId! },
      parsed.data,
    );
    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create room" } }, { status });
  }
}
