import { NextResponse } from "next/server";
import { z } from "zod";
import { respondToGuest } from "@/lib/chatbot";

const chatbotMessageSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  propertyId: z.string().optional().nullable(),
  sessionKey: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  customerUserId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatbotMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid request body." } },
        { status: 400 },
      );
    }

    const outcome = await respondToGuest({
      organizationId: parsed.data.organizationId,
      propertyId: parsed.data.propertyId,
      sessionKey: parsed.data.sessionKey,
      message: parsed.data.message,
      customerUserId: parsed.data.customerUserId,
    });

    return NextResponse.json({ success: true, data: outcome });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: { message: err.message ?? "Failed to process chat message." } },
      { status: 500 },
    );
  }
}
