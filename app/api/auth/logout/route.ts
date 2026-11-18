import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/actions";

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true, data: null });
  return clearSessionCookie(response, request);
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ success: true, data: null });
  return clearSessionCookie(response, request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/login";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/login";

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  let safeHost = host;
  if (!safeHost || safeHost.startsWith("0.0.0.0")) {
    const port = safeHost.split(":")[1] || "3000";
    safeHost = `localhost:${port}`;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  let proto = forwardedProto;
  if (!proto) {
    if (safeHost.includes("localhost") || safeHost.includes("127.0.0.1")) {
      proto = "http";
    } else {
      proto = request.url.startsWith("https://") ? "https" : "http";
    }
  }

  const response = NextResponse.redirect(new URL(target, `${proto}://${safeHost}`));
  return clearSessionCookie(response, request);
}
