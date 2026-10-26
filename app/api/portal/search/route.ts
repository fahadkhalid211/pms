import { NextResponse } from "next/server";
import { z } from "zod";
import { searchAvailableRooms } from "@/lib/portal";

const searchSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  propertyId: z.string().optional(),
  checkIn: z.string().min(1, "Check-in date is required"),
  checkOut: z.string().min(1, "Check-out date is required"),
  adults: z.number().int().positive().default(2),
  children: z.number().int().nonnegative().default(0),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid search parameters" } },
        { status: 400 },
      );
    }

    const results = await searchAvailableRooms(parsed.data);
    return NextResponse.json({ success: true, data: results });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: { message: err.message ?? "Search failed" } }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const propertyId = searchParams.get("propertyId") || undefined;
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    const adults = Number(searchParams.get("adults") || "2");
    const children = Number(searchParams.get("children") || "0");

    if (!organizationId || !checkIn || !checkOut) {
      return NextResponse.json(
        { success: false, error: { message: "organizationId, checkIn, and checkOut are required parameters" } },
        { status: 400 },
      );
    }

    const results = await searchAvailableRooms({
      organizationId,
      propertyId,
      checkIn,
      checkOut,
      adults,
      children,
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: { message: err.message ?? "Search failed" } }, { status: 400 });
  }
}
