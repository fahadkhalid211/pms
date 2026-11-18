import { describe, it, expect } from "vitest";
import { authenticate } from "@/lib/auth/actions";
import { verifySessionToken } from "@/lib/auth/jwt";
import { resolveUserContext } from "@/lib/auth/session";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

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

  it("middleware clears invalid or corrupted cookie on protected path and redirects to login", async () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "lumina.session=invalid-garbage-token",
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fdashboard");
    // Cookie is deleted
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("lumina.session=;");
  });

  it("middleware never redirects back to /dashboard if next parameter is present on /login", async () => {
    const req = new NextRequest("http://localhost:3000/login?next=%2Fdashboard", {
      headers: {
        cookie: "lumina.session=some-stale-token",
      },
    });
    const res = await middleware(req);
    // Should NOT redirect back to /dashboard
    expect(res.status).not.toBe(307);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("lumina.session=;");
  });
});
