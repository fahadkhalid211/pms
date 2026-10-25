import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/auth/actions";
import { hashPassword } from "@/lib/auth/passwords";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid password" } },
        { status: 400 },
      );
    }
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: parsed.data.token },
    });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ success: false, error: { message: "Reset token is invalid or has expired." } }, { status: 400 });
    }
    const hash = await hashPassword(parsed.data.password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, passwordResetToken: null, passwordResetExpires: null },
    });
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to reset password" } }, { status: 400 });
  }
}
