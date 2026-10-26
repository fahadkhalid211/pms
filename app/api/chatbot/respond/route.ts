import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth/session";
import { respondToGuest } from "@/lib/chatbot";

const respondSchema = z.object({
  message: z.string().min(1, "Message is required"),
  propertyId: z.string().optional().nullable(),
  sessionKey: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext(request);
    const body = await request.json();
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid request body." } },
        { status: 400 },
      );
    }

    const organizationId = auth.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const outcome = await respondToGuest({
      organizationId,
      propertyId: parsed.data.propertyId,
      sessionKey: parsed.data.sessionKey,
      message: parsed.data.message,
      customerUserId: auth.user.id,
    });

    return NextResponse.json({ success: true, data: outcome });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Chatbot response failed" } }, { status: 500 });
  }
}
