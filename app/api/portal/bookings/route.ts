import { NextResponse } from "next/server";
import { getCustomerBookings } from "@/lib/portal";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const email = searchParams.get("email");

    if (!organizationId || !email) {
      return NextResponse.json(
        { success: false, error: { message: "organizationId and email are required" } },
        { status: 400 },
      );
    }

    const bookings = await getCustomerBookings(organizationId, email);
    return NextResponse.json({ success: true, data: bookings });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Failed to retrieve bookings" } },
      { status: 500 },
    );
  }
}
