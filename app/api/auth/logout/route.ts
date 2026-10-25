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
