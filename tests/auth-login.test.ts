import { describe, it, expect } from "vitest";
import { authenticate } from "@/lib/auth/actions";
import { verifySessionToken } from "@/lib/auth/jwt";
import { resolveUserContext } from "@/lib/auth/session";

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
});
