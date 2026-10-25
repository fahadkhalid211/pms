import { NextResponse } from "next/server";
import { resetPasswordSchema, resetPasswordWithToken } from "@/lib/auth/actions";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`reset-pw:${ip}`, 5, 60_000);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: { message: `Too many password reset attempts. Please retry in ${limit.retryAfterSeconds} seconds.` } },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid password payload" } },
        { status: 400 },
      );
    }
    await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error: any) {
    const status = error?.status ?? 400;
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to reset password" } }, { status });
  }
}
