import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/passwords";
import { syncSystemRolesAndPermissions, ROLE_DEFINITIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";

const STAFF_ROLE_KEYS = ["admin", "manager", "front_desk", "housekeeping"] as const;

const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  roleKey: z.enum(STAFF_ROLE_KEYS).default("front_desk"),
  propertyIds: z.array(z.string().min(1)).optional().default([]),
});

export async function GET() {
  try {
    const user = await requirePermission("staff.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const [members, roles, properties] = await Promise.all([
      prisma.organizationMembership.findMany({
        where: { organizationId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
              roleKey: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.role.findMany({
        where: { organizationId },
        select: { id: true, key: true, name: true, description: true },
      }),
      prisma.property.findMany({
        where: { organizationId, status: { not: "archived" } },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const availableRoles =
      roles.length > 0
        ? roles.filter((r) => STAFF_ROLE_KEYS.includes(r.key as (typeof STAFF_ROLE_KEYS)[number]))
        : ROLE_DEFINITIONS.filter((r) => STAFF_ROLE_KEYS.includes(r.key as (typeof STAFF_ROLE_KEYS)[number])).map((r) => ({
            id: r.key,
            key: r.key,
            name: r.name,
            description: r.description,
          }));

    return NextResponse.json({
      success: true,
      data: members,
      meta: {
        roles: availableRoles,
        properties,
        currentUserId: user.id,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load staff" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requirePermission("staff.manage");
    const organizationId = currentUser.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid staff account details" } },
        { status: 400 },
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { message: "A user with this email address already exists." } },
        { status: 409 },
      );
    }

    // Validate scoped property IDs belong to this organization
    let scopedPropertyIds: string[] = [];
    if (parsed.data.propertyIds.length > 0) {
      const validProperties = await prisma.property.findMany({
        where: { organizationId, id: { in: parsed.data.propertyIds } },
        select: { id: true },
      });
      scopedPropertyIds = validProperties.map((p) => p.id);
    }

    // Ensure system roles exist for this organization and resolve roleId
    let roleRecord = await prisma.role.findFirst({
      where: { organizationId, key: parsed.data.roleKey },
    });
    if (!roleRecord) {
      await syncSystemRolesAndPermissions(organizationId);
      roleRecord = await prisma.role.findFirst({
        where: { organizationId, key: parsed.data.roleKey },
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const membership = await prisma.$transaction(async (tx) => {
      const staffUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: parsed.data.name,
          passwordHash,
          roleKey: parsed.data.roleKey,
          organizationId,
          status: "active",
          propertyIds: scopedPropertyIds,
        },
      });

      const createdMembership = await tx.organizationMembership.create({
        data: {
          organizationId,
          userId: staffUser.id,
          roleId: roleRecord?.id ?? null,
          roleKey: parsed.data.roleKey,
          status: "active",
          propertyIds: scopedPropertyIds,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
              roleKey: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
      });

      if (scopedPropertyIds.length > 0) {
        await tx.propertyMembership.createMany({
          data: scopedPropertyIds.map((propertyId) => ({
            organizationId,
            propertyId,
            userId: staffUser.id,
            isAdmin: parsed.data.roleKey === "admin" || parsed.data.roleKey === "manager",
            status: "active",
          })),
        });
      }

      return createdMembership;
    });

    await logActivity({
      organizationId,
      userId: currentUser.id,
      source: "backend",
      category: "auth",
      action: "staff.created",
      summary: `Created staff account for ${membership.user.name} (${membership.user.email}) with role '${parsed.data.roleKey}'.`,
      entityType: "OrganizationMembership",
      entityId: membership.id,
      metadata: {
        staffUserId: membership.userId,
        roleKey: parsed.data.roleKey,
        propertyCount: scopedPropertyIds.length,
      },
    });

    return NextResponse.json({ success: true, data: membership }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { status?: number; code?: string; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    if (err?.code === "P2002") {
      return NextResponse.json({ success: false, error: { message: "A user with this email address already exists." } }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to create staff member" } }, { status: 400 });
  }
}
