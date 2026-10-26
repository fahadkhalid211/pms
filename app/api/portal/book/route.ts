import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicBooking } from "@/lib/portal";

const bookSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  propertyId: z.string().min(1, "Property ID is required"),
  roomTypeId: z.string().min(1, "Room type is required"),
  checkIn: z.string().min(1, "Check-in date is required"),
  checkOut: z.string().min(1, "Check-out date is required"),
  adults: z.number().int().positive().default(1),
  children: z.number().int().nonnegative().default(0),
  guest: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(),
  }),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid booking information" } },
        { status: 400 },
      );
    }

    const booking = await createPublicBooking(parsed.data);
    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: { message: err.message ?? "Booking creation failed" } }, { status: 400 });
  }
}
