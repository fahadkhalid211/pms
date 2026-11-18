import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/actions";

export async function POST() {
  const response = NextResponse.json({ success: true, data: null });
  return clearSessionCookie(response);
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, data: null });
  return clearSessionCookie(response);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/login";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/login";
  const response = NextResponse.redirect(new URL(target, request.url));
  return clearSessionCookie(response);
}
