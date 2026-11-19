"use server";

import { authenticate } from "@/lib/auth/actions";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";

export interface LoginActionState {
  error?: string | null;
}

export async function loginAction(
  _prevState: LoginActionState | undefined,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get("email")?.toString()?.trim() || "";
  const password = formData.get("password")?.toString() || "";
  const rawNext = formData.get("next")?.toString() || "";

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  let user: any;
  let token: string;
  let membership: any;

  try {
    const result = await authenticate(email, password);
    token = result.token;
    user = result.user;
    membership = result.membership;
  } catch (err: any) {
    return { error: err?.message || "Invalid email or password." };
  }

  try {
    await auditLog({
      userId: user.id,
      organizationId: membership?.organizationId ?? null,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
    });
  } catch {
    // Non-blocking
  }

  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto");
  const referer = headerList.get("referer");
  const origin = headerList.get("origin");
  const host = headerList.get("host") || headerList.get("x-forwarded-host") || "";

  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0");
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";

  let isHttps = false;
  if (proto === "https") {
    isHttps = true;
  } else if (proto === "http") {
    isHttps = false;
  } else if (isLocalhost) {
    isHttps = false;
  } else if (authUrl.startsWith("https://")) {
    isHttps = true;
  } else if (origin?.startsWith("https://")) {
    isHttps = true;
  } else if (referer?.startsWith("https://")) {
    isHttps = true;
  }

  const cookieStore = await cookies();
  cookieStore.set("lumina.session", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  const isDisallowed =
    !rawNext ||
    rawNext === "/login" ||
    rawNext.startsWith("/login?") ||
    rawNext.startsWith("/login/") ||
    rawNext === "/register" ||
    rawNext.startsWith("/register?") ||
    !rawNext.startsWith("/") ||
    rawNext.startsWith("//");

  const target = isDisallowed ? "/dashboard" : rawNext;

  redirect(target);
}
