import { NextResponse } from "next/server";
import { z } from "zod";
import { submitOnlineCheckIn } from "@/lib/portal";

const checkInSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  bookingCode: z.string().min(1, "Booking code is required"),
  email: z.string().email("Valid email is required"),
  estimatedArrival: z.string().optional(),
  idVerifiedAck: z.boolean().default(true),
  emergencyContact: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
  specialRequests: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid check-in details" } },
        { status: 400 },
      );
    }

    const result = await submitOnlineCheckIn(parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Online check-in submission failed" } },
      { status: 400 },
    );
  }
}
