import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/passwords";
import { syncSystemRolesAndPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";
import { parseCsvRecords, parseXlsxRecords } from "@/lib/csv";

const STAFF_ROLE_KEYS = ["admin", "manager", "front_desk", "housekeeping"] as const;

const bulkUserItemSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
  roleKey: z.enum(STAFF_ROLE_KEYS).optional().default("front_desk"),
  propertyCodes: z.array(z.string().trim()).optional().default([]),
  propertyIds: z.array(z.string().trim()).optional().default([]),
});

const bulkUsersPayloadSchema = z.object({
  users: z.array(bulkUserItemSchema).min(1, "At least one user is required").max(200),
});

export async function POST(request: Request) {
  try {
    const currentUser = await requirePermission("staff.manage");
    const organizationId = currentUser.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    let usersInput: unknown[] = [];
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: { message: "No spreadsheet file (.xlsx/.csv) uploaded." } }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      const isXlsx = /\.(xlsx|xls)$/i.test(file.name);
      const records = isXlsx ? parseXlsxRecords(buffer) : parseCsvRecords(new TextDecoder().decode(buffer));
      usersInput = records.map((r) => {
        const rawRole = (r.role || r.role_key || "front_desk").toLowerCase().trim();
        const rawCodes = (r.property_codes || r.properties || "").trim();
        return {
          name: (r.name || r.full_name || "").trim(),
          email: (r.email || "").trim(),
          roleKey: rawRole,
          password: (r.password || "").trim() || undefined,
          propertyCodes: rawCodes ? rawCodes.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [],
        };
      });
    } else {
      const body = await request.json();
      usersInput = body.users;
    }

    const parsed = bulkUsersPayloadSchema.safeParse({ users: usersInput });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid bulk users payload" } },
        { status: 400 },
      );
    }

    // Ensure system roles exist for the organization
    let orgRoles = await prisma.role.findMany({ where: { organizationId } });
    if (orgRoles.length === 0) {
      await syncSystemRolesAndPermissions(organizationId);
      orgRoles = await prisma.role.findMany({ where: { organizationId } });
    }
    const roleMap = new Map(orgRoles.map((r) => [r.key, r.id]));

    const orgProperties = await prisma.property.findMany({
      where: { organizationId },
      select: { id: true, code: true },
    });
    const propById = new Set(orgProperties.map((p) => p.id));
    const propByCode = new Map(orgProperties.map((p) => [p.code.toUpperCase(), p.id]));

    const created: Array<{ id: string; email: string; name: string; roleKey: string; status: string }> = [];
    const skipped: Array<{ email: string; reason: string }> = [];
    const seenBatchEmails = new Set<string>();

    for (const item of parsed.data.users) {
      const normalizedEmail = item.email.toLowerCase().trim();
      if (seenBatchEmails.has(normalizedEmail)) {
        skipped.push({ email: normalizedEmail, reason: "Duplicate email in import batch" });
        continue;
      }
      seenBatchEmails.add(normalizedEmail);

      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        skipped.push({ email: normalizedEmail, reason: "Account with this email already exists" });
        continue;
      }

      const resolvedPropertyIds = Array.from(
        new Set([
          ...item.propertyIds.filter((id) => propById.has(id)),
          ...item.propertyCodes
            .map((c) => propByCode.get(c.toUpperCase()))
            .filter((id): id is string => Boolean(id)),
        ]),
      );

      const hasExplicitPassword = Boolean(item.password && item.password.length >= 8);
      const rawPassword = hasExplicitPassword
        ? item.password!
        : crypto.randomBytes(24).toString("hex");
      const passwordHash = await hashPassword(rawPassword);
      const status = hasExplicitPassword ? "active" : "invited";
      const roleId = roleMap.get(item.roleKey) ?? null;

      const createdMembership = await prisma.$transaction(async (tx) => {
        const staffUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: item.name,
            passwordHash,
            roleKey: item.roleKey,
            organizationId,
            status,
            propertyIds: resolvedPropertyIds,
          },
        });

        const membership = await tx.organizationMembership.create({
          data: {
            organizationId,
            userId: staffUser.id,
            roleId,
            roleKey: item.roleKey,
            status,
            propertyIds: resolvedPropertyIds,
          },
        });

        if (resolvedPropertyIds.length > 0) {
          await tx.propertyMembership.createMany({
            data: resolvedPropertyIds.map((propertyId) => ({
              organizationId,
              propertyId,
              userId: staffUser.id,
              isAdmin: item.roleKey === "admin" || item.roleKey === "manager",
              status,
            })),
          });
        }

        return { staffUser, membership };
      });

      created.push({
        id: createdMembership.membership.id,
        email: createdMembership.staffUser.email,
        name: createdMembership.staffUser.name,
        roleKey: item.roleKey,
        status,
      });
    }

    await logActivity({
      organizationId,
      userId: currentUser.id,
      source: "backend",
      category: "auth",
      action: "staff.bulk_imported",
      summary: `Bulk imported ${created.length} staff user accounts (${skipped.length} skipped).`,
      metadata: { importedCount: created.length, skippedCount: skipped.length },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          imported: created.length,
          skippedCount: skipped.length,
          created,
          skipped,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Bulk staff import failed" } }, { status: 400 });
  }
}
