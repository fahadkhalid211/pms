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

const NO_STORE = "no-store, no-cache, must-revalidate, max-age=0";

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';",
  );
  // Prevent Hostinger CDN and any proxy from caching auth-aware responses
  response.headers.set("Cache-Control", NO_STORE);
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("CDN-Cache-Control", "no-store");
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

function isOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // If neither origin nor referer is provided, allow (non-browser or same-origin direct clients)
  if (!origin && !referer) {
    return true;
  }

  const validHosts = new Set<string>();

  // 1. Host header
  const rawHost = request.headers.get("host");
  if (rawHost) {
    validHosts.add(rawHost.toLowerCase());
    validHosts.add(rawHost.split(":")[0].toLowerCase());
  }

  // 2. X-Forwarded-Host (can be comma-separated list of proxies)
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    forwardedHost.split(",").forEach((h) => {
      const trimmed = h.trim().toLowerCase();
      if (trimmed) {
        validHosts.add(trimmed);
        validHosts.add(trimmed.split(":")[0]);
      }
    });
  }

  // 3. Next.js internal URL host
  if (request.nextUrl?.host) {
    validHosts.add(request.nextUrl.host.toLowerCase());
    validHosts.add(request.nextUrl.hostname.toLowerCase());
  }

  // 4. Configured AUTH_URL / NEXTAUTH_URL
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (authUrl) {
    try {
      const u = new URL(authUrl);
      validHosts.add(u.host.toLowerCase());
      validHosts.add(u.hostname.toLowerCase());
    } catch {}
  }

  // 5. Canonical production domains
  validHosts.add("penthousepms.com");
  validHosts.add("www.penthousepms.com");
  validHosts.add("olive-pigeon-172996.hostingersite.com");

  const isLocalHost = (h: string) => {
    const clean = h.split(":")[0].toLowerCase();
    return clean === "localhost" || clean === "127.0.0.1" || clean === "0.0.0.0" || clean === "::1";
  };

  const hasLocalHost = Array.from(validHosts).some(isLocalHost);

  // Check Origin header first
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.host.toLowerCase();
      const originHostname = originUrl.hostname.toLowerCase();

      if (validHosts.has(originHost) || validHosts.has(originHostname)) {
        return true;
      }
      if (isLocalHost(originHostname) && hasLocalHost) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Fallback to Referer header if Origin is not present
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.host.toLowerCase();
      const refererHostname = refererUrl.hostname.toLowerCase();

      if (validHosts.has(refererHost) || validHosts.has(refererHostname)) {
        return true;
      }
      if (isLocalHost(refererHostname) && hasLocalHost) {
        return true;
      }
      return false;
    } catch {
      return true; // Ignore malformed referers if origin was not present
    }
  }

  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 1. CSRF Origin Verification for state-modifying requests
  // Webhooks, integrations, public chatbot, customer portal, auth endpoints, and Next.js Server Actions are exempt
  const isServerAction = request.headers.has("next-action");
  const isAuthOrPublicEndpoint =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/integrations/webhooks") ||
    pathname.startsWith("/api/integrations/ical") ||
    pathname.startsWith("/api/chatbot") ||
    pathname.startsWith("/api/portal");

  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    !isServerAction &&
    !isAuthOrPublicEndpoint
  ) {
    if (!isOriginAllowed(request)) {
      return new NextResponse(
        JSON.stringify({ success: false, error: { message: "Cross-Site Request Forgery origin mismatch" } }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // 2. Authentication check for protected app pages
  const isProtectedPath = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const sessionCookie = request.cookies.get("lumina.session")?.value;

  if (isProtectedPath && !sessionCookie) {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const loginUrl = request.nextUrl.clone();

    if (forwardedHost) {
      const [h, p] = forwardedHost.split(":");
      loginUrl.hostname = h;
      if (p) {
        loginUrl.port = p;
      } else if (forwardedProto === "https") {
        loginUrl.port = "";
      }
    }
    if (forwardedProto) {
      loginUrl.protocol = `${forwardedProto}:`;
    }
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
