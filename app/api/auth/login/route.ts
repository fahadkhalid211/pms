import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/actions";
import { authenticate, setSessionCookie } from "@/lib/auth/actions";
import { auditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid login details" } },
        { status: 400 },
      );
    }
    const { token, user, membership } = await authenticate(parsed.data.email, parsed.data.password);
    await auditLog({
      userId: user.id,
      organizationId: membership?.organizationId ?? null,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
    });
    const response = NextResponse.json({ success: true, data: { id: user.id, email: user.email, name: user.name } });
    return setSessionCookie(response, token);
  } catch (error: any) {
    if (error?.status === 401) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 401 });
    }
    if (error?.status === 403) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: { message: error?.issues?.[0]?.message ?? error?.message ?? "Login failed" } }, { status: 400 });
  }
}
