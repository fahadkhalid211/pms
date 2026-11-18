import { describe, it, expect } from "vitest";
import { authenticate } from "../lib/auth/actions";
import { verifySessionToken } from "../lib/auth/jwt";
import { resolveUserContext } from "../lib/auth/session";
import { middleware } from "../middleware";
import { NextRequest } from "next/server";

describe("Production session and login flow verification", () => {
  it("authenticates admin user and resolves session context", async () => {
    const { token, user } = await authenticate("admin@lumina.pms", "Password123!");
    expect(token).toBeTruthy();
    expect(user).toBeTruthy();

    const verified = await verifySessionToken(token);
    expect(verified).toBeTruthy();
    expect(verified?.sub).toBe(user.id);

    const resolved = await resolveUserContext(verified!.sub, verified!.email);
    expect(resolved).toBeTruthy();
    expect(resolved?.email).toBe("admin@lumina.pms");

    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: `lumina.session=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("checks middleware behavior when request comes from reverse proxy", async () => {
    const { token } = await authenticate("admin@lumina.pms", "Password123!");

    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        host: "localhost:3000",
        "x-forwarded-host": "pms.thepenthouseliving.com",
        "x-forwarded-proto": "https",
        cookie: `lumina.session=${token}`,
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows POST requests when reverse proxy sets x-forwarded-host matching Origin", async () => {
    const req = new NextRequest("http://localhost:3000/api/some-endpoint", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        "x-forwarded-host": "pms.thepenthouseliving.com",
        "x-forwarded-proto": "https",
        origin: "https://pms.thepenthouseliving.com",
        referer: "https://pms.thepenthouseliving.com/some-page",
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows login and auth endpoints regardless of proxy headers", async () => {
    const req = new NextRequest("http://localhost:3000/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        "x-forwarded-host": "any-domain.com",
        origin: "https://any-domain.com",
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("allows Next.js Server Actions with next-action header", async () => {
    const req = new NextRequest("http://localhost:3000/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        "next-action": "abc12345",
        origin: "https://custom-proxy.com",
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});
