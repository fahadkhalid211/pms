import { NextResponse } from "next/server";
import { registerSchema, createUserWithContext, hashSession, setSessionCookie } from "@/lib/auth/actions";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`register:${ip}`, 10, 60_000);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: { message: `Too many registration attempts. Please retry in ${limit.retryAfterSeconds} seconds.` } },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid registration payload" } },
        { status: 400 },
      );
    }

    const { user, organization, permissions } = await createUserWithContext({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      organizationName: parsed.data.organizationName,
    });

    const token = await hashSession({
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: organization.id,
      roleKey: "admin",
      propertyIds: [],
      permissions,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: { id: organization.id, name: organization.name, slug: organization.slug },
      },
    }, { status: 201 });

    return setSessionCookie(response, token);
  } catch (error: any) {
    if (error?.status === 409) {
      return NextResponse.json({ success: false, error: { message: error.message } }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Registration failed" } }, { status: 400 });
  }
}
