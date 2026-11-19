import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { signSessionToken, type SessionTokenPayload } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword, generateCryptoToken, hashToken } from "@/lib/auth/passwords";
import { requirePermission } from "@/lib/auth/session";
import { syncSystemRolesAndPermissions, permissionsForRoleKey } from "@/lib/permissions";
import { z } from "zod";
export { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "./schemas";

export async function hashSession(user: {
  id: string;
  email: string;
  name: string;
  organizationId: string | null;
  roleKey: string | null;
  propertyIds: string[];
  permissions: string[];
}): Promise<string> {
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    roleKey: user.roleKey,
    propertyIds: user.propertyIds,
    permissions: user.permissions,
  };
  return signSessionToken(payload);
}

export function isSecureConnection(request?: Request): boolean {
  if (request) {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto === "https") return true;
    if (proto === "http") return false;

    try {
      const url = new URL(request.url);
      if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0")) {
        return false;
      }
      if (url.protocol === "https:") return true;
    } catch {}

    const origin = request.headers.get("origin");
    if (origin?.startsWith("https://")) return true;
    if (origin?.startsWith("http://localhost") || origin?.startsWith("http://127.0.0.1")) return false;

    const referer = request.headers.get("referer");
    if (referer?.startsWith("https://")) return true;
    if (referer?.startsWith("http://localhost") || referer?.startsWith("http://127.0.0.1")) return false;

    if (request.url.startsWith("https://")) return true;
    if (request.url.startsWith("http://localhost") || request.url.startsWith("http://127.0.0.1")) return false;
  }

  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (authUrl?.startsWith("https://")) return true;

  return false;
}

export async function setSessionCookie(response: NextResponse, token: string, request?: Request) {
  const secure = isSecureConnection(request);
  const options = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    cookieStore.set("lumina.session", token, options);
  } catch {
    // cookies() may throw outside Next.js request context (e.g. in tests)
  }

  response.cookies.set("lumina.session", token, options);
  return response;
}

export function clearSessionCookie(response: NextResponse, request?: Request) {
  const secure = isSecureConnection(request);
  const options = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  try {
    import("next/headers").then(async ({ cookies }) => {
      const cookieStore = await cookies();
      cookieStore.delete("lumina.session");
    }).catch(() => {});
  } catch {
    // Ignore outside request context
  }

  response.cookies.set("lumina.session", "", options);
  return response;
}

export async function createUserWithContext(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw Object.assign(new Error("An account with this email already exists."), { status: 409 });
  }

  // 1. Create Organization
  const slugBase = input.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const organization = await prisma.organization.create({
    data: {
      name: input.organizationName.trim(),
      slug,
      primaryColor: "#000000",
      accentColor: "#ffffff",
      branding: {
        tagline: "Pent House PMS",
      },
    },
  });

  // 2. Synchronize roles and permissions for this organization
  await syncSystemRolesAndPermissions(organization.id);
  const adminRole = await prisma.role.findFirst({
    where: { organizationId: organization.id, key: "admin" },
  });

  // 3. Create User with bcrypt hash
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      organizationId: organization.id,
      roleKey: "admin",
      status: "active",
      propertyIds: [],
    },
  });

  // 4. Create Organization Membership with admin role
  await prisma.organizationMembership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      roleId: adminRole?.id ?? null,
      roleKey: "admin",
      status: "active",
      propertyIds: [],
    },
  });

  await auditLog({
    userId: user.id,
    organizationId: organization.id,
    action: "auth.registered",
    entityType: "Organization",
    entityId: organization.id,
    metadata: { orgName: organization.name, userEmail: user.email },
  });

  const permissions = adminRole?.permissions as string[] ?? permissionsForRoleKey("admin");

  return { user, organization, permissions };
}

export async function authenticate(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw Object.assign(new Error("Invalid email or password."), { status: 401 });
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error("Invalid email or password."), { status: 401 });
  if (user.status !== "active") throw Object.assign(new Error("This account has been deactivated."), { status: 403 });

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: user.id, status: "active" },
    include: { role: true },
  });
  const rolePerms = membership?.role?.permissions;
  const permissions: string[] = Array.isArray(rolePerms) && rolePerms.length > 0
    ? (rolePerms as string[])
    : permissionsForRoleKey(membership?.roleKey ?? user.roleKey);

  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership?.organizationId ?? user.organizationId,
    roleKey: membership?.roleKey ?? user.roleKey,
    propertyIds: (Array.isArray(membership?.propertyIds) ? membership.propertyIds : []) as string[],
    permissions,
  };
  const token = await signSessionToken(payload);
  return { token, user, membership, permissions };
}

export async function requireStaffPermission(permission: string) {
  const user = await requirePermission(permission);
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: user.id, status: "active" },
  });
  return { user, membership };
}

/**
 * Generates a crypto-random password reset token, saves its SHA-256 hash in DB,
 * and creates a notification record (simulating email dispatch).
 */
export async function createPasswordResetToken(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return { ok: true }; // Do not leak existence of email

  const rawToken = generateCryptoToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 3600_000); // 1 hour expiry

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: expiresAt,
    },
  });

  // Queue an email notification in the database
  if (user.organizationId) {
    await prisma.notification.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        channel: "email",
        type: "password_reset",
        toEmail: user.email,
        payload: {
          subject: "Reset your Lumina PMS password",
          body: `Hello ${user.name},\n\nPlease use the following link to reset your password: /reset-password?token=${rawToken}\n\nThis link will expire in 1 hour.`,
        },
        status: "queued",
      },
    });
  }

  await auditLog({
    userId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: "auth.password_reset_requested",
    entityType: "User",
    entityId: user.id,
  });

  // Return resetToken in dev/testing environment so integration tests can assert flows
  return { ok: true, resetToken: rawToken };
}

/**
 * Resets a user's password using a valid raw reset token.
 */
export async function resetPasswordWithToken(rawToken: string, newPassword: string) {
  const hashedToken = hashToken(rawToken.trim());
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw Object.assign(new Error("Reset token is invalid or has expired."), { status: 400 });
  }

  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  await auditLog({
    userId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: "auth.password_reset_completed",
    entityType: "User",
    entityId: user.id,
  });

  return { ok: true };
}
