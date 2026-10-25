export const ALL_PERMISSIONS = [
  // Dashboard & reporting
  "dashboard.view",
  "reports.view",
  // Properties & rooms
  "properties.view",
  "properties.manage",
  "rooms.view",
  "rooms.manage",
  "rates.manage",
  // Reservations
  "reservations.view",
  "reservations.create",
  "reservations.update",
  "reservations.cancel",
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
  // Guests
  "guests.view",
  "guests.create",
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
    key: "manager",
    name: "Property Manager",
    description: "Operational oversight across reservations, billing, and reporting.",
    permissions: [
      "dashboard.view",
      "reports.view",
      "properties.view",
      "rooms.view",
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
      "support.view",
      "ai.operate",
    ] as Permission[],
  },
] as const;

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  permission: Permission,
): boolean {
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function permissionsForRoleKey(roleKey: string | null | undefined): Permission[] {
  if (!roleKey) return [];
  const def = ROLE_DEFINITIONS.find((r) => r.key === roleKey);
  return def ? [...def.permissions] : [];
}
