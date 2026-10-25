import { describe, it, expect } from "vitest";
import { hasPermission, permissionsForRoleKey, ROLE_DEFINITIONS, ALL_PERMISSIONS } from "@/lib/permissions";

describe("permissions", () => {
  it("grants all permissions to the administrator role", () => {
    const perms = permissionsForRoleKey("admin");
    expect(perms.length).toBeGreaterThan(0);
    for (const permission of ALL_PERMISSIONS) {
      expect(perms).toContain(permission);
    }
  });

  it("supports permission checks", () => {
    expect(hasPermission(["reservations.view", "reservations.create"], "reservations.create")).toBe(true);
    expect(hasPermission(["reservations.view"], "reservations.create")).toBe(false);
    expect(hasPermission(null, "billing.view")).toBe(false);
  });

  it("defines multiple staff roles", () => {
    expect(ROLE_DEFINITIONS.length).toBeGreaterThanOrEqual(3);
    expect(permissionsForRoleKey("front_desk").length).toBeGreaterThan(0);
  });
});
