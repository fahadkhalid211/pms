import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/auth/actions";
import { createUserWithContext, hashSession, setSessionCookie } from "@/lib/auth/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.parse(body);
    const { user, organization } = await createUserWithContext({
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
      organizationName: parsed.organizationName,
    });
    const token = await hashSession({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      roleKey: user.roleKey,
      propertyIds: [],
      permissions: ["admin"],
    });
    const response = NextResponse.json({ success: true, data: { id: user.id, email: user.email } });
    return setSessionCookie(response, token);
  } catch (error: any) {
    if (error?.status === 409) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Registration failed" } }, { status: 400 });
  }
}
