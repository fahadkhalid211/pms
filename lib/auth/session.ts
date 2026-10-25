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

export interface AuthContext {
  user: SessionUser;
  organizationId: string;
  propertyIds: string[];
  isOrgAdmin: boolean;
  isCustomer: boolean;
  hasPermission: (perm: string) => boolean;
  hasPropertyAccess: (propertyId: string) => boolean;
}

export async function resolveUserContext(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: "active" },
        include: { organization: true, role: true },
      },
      propertyMemberships: {
        where: { status: "active" },
      },
    },
  });
  if (!user || user.status !== "active") return null;

  const membership = user.memberships[0];
  const orgMembership =
    user.memberships.find((m) => m.role?.key === "admin" || m.roleKey === "admin") ??
    membership;

  const resolvedRole = orgMembership?.role ?? membership?.role;
  const rawPerms = resolvedRole?.permissions;
  const permissions: string[] = Array.isArray(rawPerms) ? (rawPerms as string[]) : [];

  // Combine explicit user property IDs, membership property IDs, and property memberships
  const explicitPropIds = Array.isArray(user.propertyIds) ? (user.propertyIds as string[]) : [];
  const memberPropIds = Array.isArray(membership?.propertyIds) ? (membership.propertyIds as string[]) : [];
  const directPropIds = user.propertyMemberships.map((pm) => pm.propertyId);

  const propertyIds = Array.from(new Set([...explicitPropIds, ...memberPropIds, ...directPropIds]));

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

export function extractTokenFromRequest(request?: Request): string | null {
  if (!request) return null;
  // 1. Authorization header: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  // 2. Cookie header: lumina.session=<token>
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/lumina\.session=([^;]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function getSession(request?: Request): Promise<Session | null> {
  try {
    let token = extractTokenFromRequest(request);
    if (!token) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        token = cookieStore.get("lumina.session")?.value ?? null;
      } catch {
        // cookies() may throw outside Next.js request context (e.g. in tests)
        token = null;
      }
    }
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

export async function getCurrentUser(request?: Request): Promise<SessionUser | null> {
  const session = await getSession(request);
  return session?.user ?? null;
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.status = 403;
  }
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.status = 401;
  }
}

/**
 * Resolves the full AuthContext for the current request or session.
 */
export async function getAuthContext(request?: Request): Promise<AuthContext | null> {
  const user = await getCurrentUser(request);
  if (!user || !user.organizationId) return null;

  const isOrgAdmin = user.roleKey === "admin" || user.permissions.includes("admin");
  const isCustomer = user.roleKey === "customer";

  return {
    user,
    organizationId: user.organizationId,
    propertyIds: user.propertyIds,
    isOrgAdmin,
    isCustomer,
    hasPermission: (perm: string) => isOrgAdmin || user.permissions.includes(perm),
    hasPropertyAccess: (propertyId: string) => {
      if (isOrgAdmin) return true;
      // If user has specific assigned properties, must be in that list
      if (user.propertyIds.length > 0) {
        return user.propertyIds.includes(propertyId);
      }
      // If user has no property restrictions specified, allow within their organization
      return true;
    },
  };
}

export async function requireAuth(request?: Request): Promise<SessionUser> {
  const user = await getCurrentUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAuthContext(request?: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/**
 * Enforces authentication, organization scoping, required permission, and optional property scope.
 */
export async function requirePermission(
  permission: string,
  options?: { propertyId?: string; request?: Request },
): Promise<SessionUser> {
  const user = await requireAuth(options?.request);
  if (!user.organizationId) {
    throw new ForbiddenError("You must belong to an active organization.");
  }

  const isOrgAdmin = user.roleKey === "admin" || user.permissions.includes("admin");
  const allowed = isOrgAdmin || user.permissions.includes(permission);
  if (!allowed) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }

  if (options?.propertyId) {
    const propertyId = options.propertyId;
    if (!isOrgAdmin) {
      if (user.propertyIds.length > 0 && !user.propertyIds.includes(propertyId)) {
        throw new ForbiddenError(`You do not have access to property: ${propertyId}`);
      }
    }
  }

  return user;
}

export async function requireOrganizationAccess(organizationId: string, request?: Request) {
  const user = await requireAuth(request);
  if (!user.organizationId || user.organizationId !== organizationId) {
    throw new ForbiddenError("You do not have access to this organization.");
  }
  return user;
}

export async function requirePropertyAccess(propertyId: string, request?: Request) {
  const user = await requireAuth(request);
  if (!user.organizationId) {
    throw new ForbiddenError("You must belong to an active organization.");
  }

  const isOrgAdmin = user.roleKey === "admin" || user.permissions.includes("admin");
  if (isOrgAdmin) return user;

  const membership = await prisma.propertyMembership.findFirst({
    where: { userId: user.id, propertyId, organizationId: user.organizationId, status: "active" },
  });

  if (!membership && user.propertyIds.length > 0 && !user.propertyIds.includes(propertyId)) {
    throw new ForbiddenError("You do not have access to this property.");
  }

  return user;
}
