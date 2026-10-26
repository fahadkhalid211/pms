import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/reservations",
  "/frontdesk",
  "/calendar",
  "/rooms",
  "/properties",
  "/billing",
  "/housekeeping",
  "/maintenance",
  "/reports",
  "/staff",
  "/settings",
  "/ai",
  "/guests",
  "/integrations",
  "/support",
  "/notifications",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 1. CSRF Origin Verification for state-modifying requests (webhooks authenticate via HMAC signatures)
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !pathname.startsWith("/api/webhooks")) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host");

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        // Allow same-origin or localhost variants in development
        if (originUrl.host !== host && !host.startsWith("localhost:") && !host.startsWith("127.0.0.1:")) {
          return new NextResponse(JSON.stringify({ success: false, error: { message: "Cross-Site Request Forgery origin mismatch" } }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        // Invalid origin format
        return new NextResponse(JSON.stringify({ success: false, error: { message: "Invalid Origin header" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else if (referer && host) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host && !host.startsWith("localhost:") && !host.startsWith("127.0.0.1:")) {
          return new NextResponse(JSON.stringify({ success: false, error: { message: "Cross-Site Request Forgery referer mismatch" } }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        // Ignore malformed referers if origin was not present
      }
    }
  }

  // 2. Authentication check for protected app pages
  const isProtectedPath = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const sessionCookie = request.cookies.get("lumina.session")?.value;

  if (isProtectedPath && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated and visiting /login or /register, redirect to /dashboard
  if (sessionCookie && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();

  // 3. Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (assets, images)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
