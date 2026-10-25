import { prisma } from "@/lib/db";

export const ALL_PERMISSIONS = [
  // Dashboard & reporting
  "dashboard.view",
  "reports.view",
  // Properties & rooms
  "properties.view",
  "properties.manage",
  "rooms.view",
  "rooms.manage",
  "rates.view",
  "rates.manage",
  // Reservations
  "reservations.view",
  "reservations.create",
  "reservations.update",
  "reservations.cancel",
  "reservations.view_own",
  // Front desk
  "frontdesk.view",
  "frontdesk.checkin",
  "frontdesk.checkout",
  "frontdesk.walkin",
  // Operations
  "housekeeping.view",
  "housekeeping.manage",
  "maintenance.view",
  "maintenance.manage",
  // Billing
  "billing.view",
  "billing.manage",
  // Guests & Portal
  "guests.view",
  "guests.create",
  "guest.portal",
  // Support
  "support.view",
  "support.manage",
  // AI
  "ai.operate",
  "ai.configure",
  "ai.chatbot.manage",
  // Integrations & staff
  "integrations.manage",
  "staff.manage",
  // Audit & settings
  "audit.view",
  "settings.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_DEFINITIONS = [
  {
    key: "admin",
    name: "Administrator",
    description: "Full access to every module within the organization.",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "manager",
    name: "Property Manager",
    description: "Operational oversight across reservations, billing, rates, and reporting.",
    permissions: [
      "dashboard.view",
      "reports.view",
      "properties.view",
      "properties.manage",
      "rooms.view",
      "rooms.manage",
      "rates.view",
      "rates.manage",
      "reservations.view",
      "reservations.create",
      "reservations.update",
      "reservations.cancel",
      "frontdesk.view",
      "frontdesk.checkin",
      "frontdesk.checkout",
      "frontdesk.walkin",
      "housekeeping.view",
      "housekeeping.manage",
      "maintenance.view",
      "maintenance.manage",
      "billing.view",
      "billing.manage",
      "guests.view",
      "guests.create",
      "support.view",
      "support.manage",
      "ai.operate",
      "staff.manage",
      "audit.view",
      "settings.manage",
    ] as Permission[],
  },
  {
    key: "front_desk",
    name: "Front Desk",
    description: "Front desk, reservations, and guest service operations.",
    permissions: [
      "dashboard.view",
      "properties.view",
      "rooms.view",
      "rates.view",
      "reservations.view",
      "reservations.create",
      "reservations.update",
      "frontdesk.view",
      "frontdesk.checkin",
      "frontdesk.checkout",
      "frontdesk.walkin",
      "housekeeping.view",
      "maintenance.view",
      "billing.view",
      "guests.view",
      "guests.create",
      "support.view",
      "ai.operate",
    ] as Permission[],
  },
  {
    key: "housekeeping",
    name: "Housekeeping",
    description: "Housekeeping task and maintenance coordination.",
    permissions: [
      "dashboard.view",
      "properties.view",
      "rooms.view",
      "reservations.view",
      "housekeeping.view",
      "housekeeping.manage",
      "maintenance.view",
      "maintenance.manage",
    ] as Permission[],
  },
  {
    key: "customer",
    name: "Customer / Guest",
    description: "Guest portal access for viewing personal bookings, requests, and folio.",
    permissions: [
      "guest.portal",
      "reservations.view_own",
    ] as Permission[],
  },
] as const;

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  permission: Permission | string,
): boolean {
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function permissionsForRoleKey(roleKey: string | null | undefined): Permission[] {
  if (!roleKey) return [];
  const def = ROLE_DEFINITIONS.find((r) => r.key === roleKey);
  return def ? [...def.permissions] : [];
}

/**
 * Ensures all standard permissions and system roles (plus role_permissions mappings)
 * are synchronized in the database for an organization (or globally as system templates).
 */
export async function syncSystemRolesAndPermissions(organizationId?: string) {
  // 1. Upsert all permissions in Permission table
  const permMap = new Map<string, string>();
  for (const permKey of ALL_PERMISSIONS) {
    const [module] = permKey.split(".");
    const p = await prisma.permission.upsert({
      where: { key: permKey },
      update: {
        name: permKey.replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        module: module || "general",
      },
      create: {
        key: permKey,
        name: permKey.replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `Grants ${permKey}`,
        module: module || "general",
      },
    });
    permMap.set(permKey, p.id);
  }

  // 2. Upsert roles and role-permissions
  const createdRoles = [];
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_key: {
          organizationId: organizationId ?? null as any,
          key: roleDef.key,
        },
      },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        permissions: roleDef.permissions as string[],
        isSystem: true,
      },
      create: {
        organizationId: organizationId ?? null,
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        permissions: roleDef.permissions as string[],
        isSystem: true,
      },
    });
    createdRoles.push(role);

    // Link RolePermission records
    for (const permKey of roleDef.permissions) {
      const permId = permMap.get(permKey);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  return { permissions: permMap, roles: createdRoles };
}
