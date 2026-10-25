import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { dal } from "@/lib/dal";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("reservations.view", { request });
    if (!user.organizationId) {
      return NextResponse.json({ success: false, error: { message: "No organization context found." } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    const roomIdsParam = searchParams.get("roomIds");

    if (!propertyId || !checkIn || !checkOut || !roomIdsParam) {
      return NextResponse.json(
        { success: false, error: { message: "propertyId, checkIn, checkOut, and roomIds query parameters are required." } },
        { status: 400 },
      );
    }

    const roomIds = roomIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const result = await dal.reservations.checkAvailability(
      { organizationId: user.organizationId },
      propertyId,
      roomIds,
      checkIn,
      checkOut,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 400);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to check availability" } }, { status });
  }
}
