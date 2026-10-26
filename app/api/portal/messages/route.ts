import { NextResponse } from "next/server";
import { z } from "zod";
import { sendGuestPortalMessage } from "@/lib/portal";

const messageSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  bookingCode: z.string().min(1, "Booking code is required"),
  email: z.string().email("Valid email is required"),
  message: z.string().min(1, "Message content is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid message payload" } },
        { status: 400 },
      );
    }

    const result = await sendGuestPortalMessage(parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Message delivery failed" } },
      { status: 400 },
    );
  }
}
