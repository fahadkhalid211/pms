import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getSafeOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";

  let safeHost = host;
  if (!safeHost || safeHost.startsWith("0.0.0.0")) {
    const port = safeHost.split(":")[1] || "3000";
    safeHost = `localhost:${port}`;
  }

  // Determine protocol
  const forwardedProto = request.headers.get("x-forwarded-proto");
  let proto = forwardedProto;
  if (!proto) {
    if (safeHost.includes("localhost") || safeHost.includes("127.0.0.1")) {
      proto = "http";
    } else {
      proto = request.url.startsWith("https://") ? "https" : "http";
    }
  }

  return `${proto}://${safeHost}`;
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';",
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

export function middleware(request: NextRequest) {
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
    const host = request.headers.get("host") || "";

    const isLocalHost = (h: string) =>
      h.startsWith("localhost:") ||
      h === "localhost" ||
      h.startsWith("127.0.0.1:") ||
      h === "127.0.0.1" ||
      h.startsWith("0.0.0.0:") ||
      h === "0.0.0.0";

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        // Allow same-origin or localhost/loopback variants in development
        if (originUrl.host !== host && !(isLocalHost(originUrl.host) && isLocalHost(host))) {
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
        if (refererUrl.host !== host && !(isLocalHost(refererUrl.host) && isLocalHost(host))) {
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
    const loginUrl = request.nextUrl.clone();
    if (loginUrl.hostname === "0.0.0.0") {
      loginUrl.hostname = "localhost";
    }
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
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
