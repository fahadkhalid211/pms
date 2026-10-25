import { NextResponse } from "next/server";
import { forgotPasswordSchema, createPasswordResetToken } from "@/lib/auth/actions";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`forgot-pw:${ip}`, 5, 60_000);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: { message: `Too many password reset requests. Please retry in ${limit.retryAfterSeconds} seconds.` } },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid email" } },
        { status: 400 },
      );
    }
    const result = await createPasswordResetToken(parsed.data.email);
    return NextResponse.json({ success: true, data: { ok: true, resetToken: result.resetToken } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to process request" } }, { status: 400 });
  }
}
