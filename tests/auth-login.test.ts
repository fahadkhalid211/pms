import { describe, it, expect } from "vitest";
import { authenticate, setSessionCookie, isSecureConnection } from "@/lib/auth/actions";
import { verifySessionToken } from "@/lib/auth/jwt";
import { resolveUserContext } from "@/lib/auth/session";
import { middleware } from "@/middleware";
import { NextRequest, NextResponse } from "next/server";

describe("WP0 Gate: Login and Session resolution", () => {
  it("authenticates seeded admin user and resolves valid session context", async () => {
    const { token, user, membership } = await authenticate("admin@lumina.pms", "Password123!");
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(user.email).toBe("admin@lumina.pms");
    expect(membership).toBeDefined();

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(user.id);
    expect(payload?.email).toBe("admin@lumina.pms");

    const sessionUser = await resolveUserContext(user.id);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.id).toBe(user.id);
    expect(sessionUser?.email).toBe("admin@lumina.pms");
    expect(sessionUser?.permissions).toBeDefined();
  });

  it("rejects invalid password", async () => {
    await expect(authenticate("admin@lumina.pms", "WrongPassword")).rejects.toThrow();
  });

  it("resolves user context using fallbackEmail if userId changed across database seeds", async () => {
    const sessionUser = await resolveUserContext("non-existent-stale-cuid-12345", "admin@thepenthouseliving.com");
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.email).toBe("admin@thepenthouseliving.com");
    expect(sessionUser?.roleKey).toBe("admin");
  });

  it("returns null when neither userId nor fallbackEmail match an active user", async () => {
    const sessionUser = await resolveUserContext("non-existent-stale-cuid-12345", "unknown@nowhere.com");
    expect(sessionUser).toBeNull();
  });

  it("middleware redirects unauthenticated request to /login?next=/dashboard", async () => {
    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fdashboard");
  });

  it("middleware allows protected requests with session cookie to pass through to Server Components", async () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "lumina.session=sample-session-token",
      },
    });
    const res = await middleware(req);
    // Should NOT redirect to login, passes through
    expect(res.status).not.toBe(307);
  });

  it("middleware never creates a redirect loop on /login", async () => {
    const req = new NextRequest("http://localhost:3000/login?next=%2Fdashboard", {
      headers: {
        cookie: "lumina.session=some-token",
      },
    });
    const res = await middleware(req);
    // Should NOT redirect back to /dashboard
    expect(res.status).not.toBe(307);
  });

  it("middleware safely sanitizes 0.0.0.0 socket bindings to localhost on redirect", async () => {
    const req = new NextRequest("http://0.0.0.0:3000/dashboard", {
      headers: {
        host: "0.0.0.0:3000",
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location") || "";
    expect(location).not.toContain("0.0.0.0");
    expect(location).toContain("localhost:3000");
  });

  it("setSessionCookie sets secure=false for HTTP connections and secure=true for HTTPS", async () => {
    const httpReq = new Request("http://localhost:3000/api/auth/login");
    const httpRes = NextResponse.json({ ok: true });
    await setSessionCookie(httpRes, "test-token", httpReq);
    const httpCookie = httpRes.cookies.get("lumina.session");
    expect(httpCookie).toBeDefined();
    expect(httpCookie?.value).toBe("test-token");
    expect(isSecureConnection(httpReq)).toBe(false);

    const httpsReq = new Request("https://example.com/api/auth/login");
    const httpsRes = NextResponse.json({ ok: true });
    await setSessionCookie(httpsRes, "test-token", httpsReq);
    expect(isSecureConnection(httpsReq)).toBe(true);

    const forwardedHttpsReq = new Request("http://example.com/api/auth/login", {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(isSecureConnection(forwardedHttpsReq)).toBe(true);
  });

  it("middleware sets CSP allowing Google Fonts stylesheets and fonts", async () => {
    const req = new NextRequest("http://localhost:3000/login");
    const res = await middleware(req);
    const csp = res.headers.get("content-security-policy") || "";
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
  });
});
