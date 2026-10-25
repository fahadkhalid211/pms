import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/auth/actions";
import { createPasswordResetToken } from "@/lib/auth/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid email" } },
        { status: 400 },
      );
    }
    const result = await createPasswordResetToken(parsed.data.email);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to process request" } }, { status: 400 });
  }
}
