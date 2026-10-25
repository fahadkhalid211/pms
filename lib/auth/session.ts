import prisma from "@/lib/db";
import { verifySessionToken } from "@/lib/auth/jwt";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roleKey: string | null;
  organizationId: string | null;
  propertyIds: string[];
  permissions: string[];
}

export interface Session {
  user: SessionUser;
}

export async function resolveUserContext(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: "active" },
        include: { organization: true, role: true },
      },
    },
  });
  if (!user || user.status !== "active") return null;

  const membership = user.memberships[0];
  const orgMembership =
    user.memberships.find((m) => m.role?.key === "admin") ??
    membership;

  const resolvedRole = orgMembership?.role ?? membership?.role;
  const rawPerms = resolvedRole?.permissions;
  const permissions: string[] = Array.isArray(rawPerms) ? (rawPerms as string[]) : [];

  const rawPropertyIds = membership?.propertyIds;
  const userPropertyIds = user.propertyIds;
  const propertyIds: string[] =
    Array.isArray(rawPropertyIds) && rawPropertyIds.length > 0
      ? (rawPropertyIds as string[])
      : Array.isArray(userPropertyIds)
        ? (userPropertyIds as string[])
        : [];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleKey: orgMembership?.roleKey ?? membership?.roleKey ?? user.roleKey ?? null,
    organizationId: orgMembership?.organizationId ?? membership?.organizationId ?? user.organizationId ?? null,
    propertyIds,
    permissions,
  };
}

export async function getSession(): Promise<Session | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("lumina.session")?.value;
    if (!token) return null;
    const payload = await verifySessionToken(token);
    if (!payload?.sub) return null;
    const user = await resolveUserContext(payload.sub);
    if (!user) return null;
    return { user };
  } catch (error) {
    console.error("[auth] Failed to resolve session:", error);
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.status = 403;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireAuth();
  const allowed = user.permissions.includes(permission);
  if (!allowed) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }
  return user;
}

export async function requireOrganizationAccess(organizationId: string) {
  const user = await requireAuth();
  if (!user.organizationId || user.organizationId !== organizationId) {
    throw new ForbiddenError("You do not have access to this organization.");
  }
  return user;
}

export async function requirePropertyAccess(propertyId: string) {
  const user = await requireAuth();
  const membership = await prisma.propertyMembership.findFirst({
    where: { userId: user.id, propertyId, status: "active" },
  });
  const orgAdminPath =
    user.organizationId !== null &&
    user.roleKey === "admin" &&
    (await prisma.organizationMembership.count({
      where: { organizationId: user.organizationId, userId: user.id, status: "active" },
    })) > 0;
  if (!membership?.isAdmin && !orgAdminPath) {
    throw new ForbiddenError("You do not have access to this property.");
  }
  return user;
}
