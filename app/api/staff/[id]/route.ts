import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { syncSystemRolesAndPermissions } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";

const STAFF_ROLE_KEYS = ["admin", "manager", "front_desk", "housekeeping"] as const;

const updateStaffSchema = z.object({
  roleKey: z.enum(STAFF_ROLE_KEYS).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  propertyIds: z.array(z.string().min(1)).optional(),
});

async function countActiveAdmins(organizationId: string, excludeMembershipId?: string): Promise<number> {
  return prisma.organizationMembership.count({
    where: {
      organizationId,
      roleKey: "admin",
      status: "active",
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission("staff.manage");
    const organizationId = currentUser.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid update payload" } },
        { status: 400 },
      );
    }

    const target = await prisma.organizationMembership.findFirst({
      where: { id, organizationId },
      include: { user: true },
    });

    if (!target) {
      return NextResponse.json({ success: false, error: { message: "Staff member not found." } }, { status: 404 });
    }

    // Prevent self-suspension or demoting/suspending the last active admin
    if (target.userId === currentUser.id && parsed.data.status === "suspended") {
      return NextResponse.json({ success: false, error: { message: "You cannot suspend your own account." } }, { status: 400 });
    }

    const willStopBeingActiveAdmin =
      target.roleKey === "admin" &&
      target.status === "active" &&
      ((parsed.data.roleKey && parsed.data.roleKey !== "admin") || parsed.data.status === "suspended");

    if (willStopBeingActiveAdmin) {
      const otherAdmins = await countActiveAdmins(organizationId, target.id);
      if (otherAdmins === 0) {
        return NextResponse.json(
          { success: false, error: { message: "Cannot demote or suspend the last active administrator." } },
          { status: 400 },
        );
      }
    }

    let roleId: string | undefined;
    if (parsed.data.roleKey) {
      let roleRecord = await prisma.role.findFirst({
        where: { organizationId, key: parsed.data.roleKey },
      });
      if (!roleRecord) {
        await syncSystemRolesAndPermissions(organizationId);
        roleRecord = await prisma.role.findFirst({
          where: { organizationId, key: parsed.data.roleKey },
        });
      }
      roleId = roleRecord?.id;
    }

    let scopedPropertyIds: string[] | undefined;
    if (parsed.data.propertyIds !== undefined) {
      if (parsed.data.propertyIds.length === 0) {
        scopedPropertyIds = [];
      } else {
        const validProps = await prisma.property.findMany({
          where: { organizationId, id: { in: parsed.data.propertyIds } },
          select: { id: true },
        });
        scopedPropertyIds = validProps.map((p) => p.id);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedMembership = await tx.organizationMembership.update({
        where: { id: target.id },
        data: {
          ...(parsed.data.roleKey ? { roleKey: parsed.data.roleKey, roleId: roleId ?? null } : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(scopedPropertyIds !== undefined ? { propertyIds: scopedPropertyIds } : {}),
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

      await tx.user.update({
        where: { id: target.userId },
        data: {
          ...(parsed.data.roleKey ? { roleKey: parsed.data.roleKey } : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(scopedPropertyIds !== undefined ? { propertyIds: scopedPropertyIds } : {}),
        },
      });

      if (scopedPropertyIds !== undefined) {
        await tx.propertyMembership.deleteMany({
          where: { organizationId, userId: target.userId },
        });
        if (scopedPropertyIds.length > 0) {
          const effectiveRole = parsed.data.roleKey ?? target.roleKey;
          await tx.propertyMembership.createMany({
            data: scopedPropertyIds.map((propertyId) => ({
              organizationId,
              propertyId,
              userId: target.userId,
              isAdmin: effectiveRole === "admin" || effectiveRole === "manager",
              status: parsed.data.status ?? target.status,
            })),
          });
        }
      }

      return updatedMembership;
    });

    await logActivity({
      organizationId,
      userId: currentUser.id,
      source: "backend",
      category: "auth",
      action: "staff.updated",
      summary: `Updated staff account ${updated.user.name} (${updated.user.email}): role=${updated.roleKey}, status=${updated.status}.`,
      entityType: "OrganizationMembership",
      entityId: updated.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to update staff member" } }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission("staff.manage");
    const organizationId = currentUser.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { id } = await params;
    const target = await prisma.organizationMembership.findFirst({
      where: { id, organizationId },
      include: { user: true },
    });

    if (!target) {
      return NextResponse.json({ success: false, error: { message: "Staff member not found." } }, { status: 404 });
    }

    if (target.userId === currentUser.id) {
      return NextResponse.json({ success: false, error: { message: "You cannot remove your own account." } }, { status: 400 });
    }

    if (target.roleKey === "admin" && target.status === "active") {
      const otherAdmins = await countActiveAdmins(organizationId, target.id);
      if (otherAdmins === 0) {
        return NextResponse.json(
          { success: false, error: { message: "Cannot remove the last active administrator." } },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyMembership.deleteMany({
        where: { organizationId, userId: target.userId },
      });
      await tx.organizationMembership.delete({
        where: { id: target.id },
      });
      await tx.user.update({
        where: { id: target.userId },
        data: {
          status: "deactivated",
          organizationId: null,
        },
      });
    });

    await logActivity({
      organizationId,
      userId: currentUser.id,
      source: "backend",
      category: "auth",
      action: "staff.removed",
      summary: `Removed staff account ${target.user.name} (${target.user.email}) from the organization.`,
      entityType: "OrganizationMembership",
      entityId: target.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to remove staff member" } }, { status: 500 });
  }
}
