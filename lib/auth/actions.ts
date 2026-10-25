import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { signSessionToken, type SessionTokenPayload } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { requirePermission } from "@/lib/auth/session";
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationName: z.string().min(2, "Organization name is required").optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

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

export async function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("lumina.session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set("lumina.session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function createUserWithContext(input: {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw Object.assign(new Error("An account with this email already exists."), { status: 409 });
  }

  const organization = input.organizationName
    ? await prisma.organization.create({
        data: { name: input.organizationName, slug: input.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      })
    : null;

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      organizationId: organization?.id ?? null,
      roleKey: organization ? "admin" : null,
      status: "active",
      propertyIds: [],
    },
  });

  if (organization) {
    await prisma.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        roleKey: "admin",
        status: "active",
        propertyIds: [],
      },
    });
  }

  return { user, organization };
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw Object.assign(new Error("Invalid email or password."), { status: 401 });
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error("Invalid email or password."), { status: 401 });
  if (user.status !== "active") throw Object.assign(new Error("This account has been deactivated."), { status: 403 });

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: user.id, status: "active" },
    include: { role: true },
  });
  const rolePerms = membership?.role?.permissions;
  const permissions: string[] = Array.isArray(rolePerms) ? (rolePerms as string[]) : [];
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership?.organizationId ?? user.organizationId,
    roleKey: membership?.roleKey ?? user.roleKey,
    propertyIds: [],
    permissions,
  };
  const token = await signSessionToken(payload);
  return { token, user, membership };
}

export async function requireStaffPermission(permission: string) {
  const user = await requirePermission(permission);
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: user.id, status: "active" },
  });
  return { user, membership };
}

export async function createPasswordResetToken(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: true }; // do not leak whether the email exists
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpires: new Date(Date.now() + 3600_000) },
  });
  await auditLog({ userId: user.id, action: "auth.password_reset_requested", entityType: "User", entityId: user.id });
  return { ok: true };
}
