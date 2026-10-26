import { NextResponse } from "next/server";
import { z } from "zod";
import { submitCancellationRequest } from "@/lib/portal";

const cancelSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  bookingCode: z.string().min(1, "Booking code is required"),
  email: z.string().email("Valid email is required"),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid cancellation request" } },
        { status: 400 },
      );
    }

    const result = await submitCancellationRequest(parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Cancellation request failed" } },
      { status: 400 },
    );
  }
}
