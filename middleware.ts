import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET || "lumina-dev-only-insecure-secret-change-me-32b";
const AUTH_SECRET_BYTES = new TextEncoder().encode(AUTH_SECRET);

async function isValidSessionToken(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, AUTH_SECRET_BYTES, {
      algorithms: ["HS256"],
    });
    return Boolean(payload?.sub);
  } catch {
    return false;
  }
}

function applySecurityHeaders(response: NextResponse): NextResponse {
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

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/analytics",
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
  "/activity-logs",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 1. CSRF Origin Verification for state-modifying requests (webhooks, integrations webhooks, public chatbot, and portal endpoints are exempt)
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    !pathname.startsWith("/api/webhooks") &&
    !pathname.startsWith("/api/integrations/webhooks") &&
    !pathname.startsWith("/api/integrations/ical") &&
    !pathname.startsWith("/api/chatbot") &&
    !pathname.startsWith("/api/portal")
  ) {
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

  if (isProtectedPath) {
    const hasValidSession = await isValidSessionToken(sessionCookie);
    if (!hasValidSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      if (sessionCookie) {
        redirectResponse.cookies.delete("lumina.session");
      }
      return applySecurityHeaders(redirectResponse);
    }
  }

  // 3. Guest visiting /login or /register
  if (pathname === "/login" || pathname === "/register") {
    const hasNext = request.nextUrl.searchParams.has("next");

    // If redirected to login explicitly with next param, never loop back to dashboard
    if (hasNext && sessionCookie) {
      const response = NextResponse.next();
      response.cookies.delete("lumina.session");
      return applySecurityHeaders(response);
    }

    if (!hasNext && sessionCookie) {
      const hasValidSession = await isValidSessionToken(sessionCookie);
      if (hasValidSession) {
        return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
      } else {
        // Stale or invalid session cookie: delete and allow login view
        const response = NextResponse.next();
        response.cookies.delete("lumina.session");
        return applySecurityHeaders(response);
      }
    }
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
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
