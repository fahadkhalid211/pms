import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthContext, requirePermission } from "@/lib/auth/session";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    const organizationId = auth.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "No active organization" } }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        branding: true,
        updatedAt: true,
      },
    });

    if (!org) {
      return NextResponse.json({ success: false, error: { message: "Organization not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl || null,
        primaryColor: org.primaryColor || "#000000",
        accentColor: org.accentColor || "#ffffff",
        branding: (org.branding as Record<string, any>) || {},
        updatedAt: org.updatedAt,
      },
    });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to fetch branding" } }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("settings.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "No active organization" } }, { status: 400 });
    }

    const body = await request.json();
    const { name, logoUrl, primaryColor, accentColor, branding } = body;

    // Validate hex colors if provided
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (primaryColor && !hexRegex.test(primaryColor)) {
      return NextResponse.json(
        { success: false, error: { message: "Primary color must be a valid hex code (e.g., #0f172a or #1e293b)" } },
        { status: 400 }
      );
    }
    if (accentColor && !hexRegex.test(accentColor)) {
      return NextResponse.json(
        { success: false, error: { message: "Accent color must be a valid hex code (e.g., #3b82f6 or #d97706)" } },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null;
    }
    if (primaryColor !== undefined) {
      updateData.primaryColor = primaryColor;
    }
    if (accentColor !== undefined) {
      updateData.accentColor = accentColor;
    }
    if (branding !== undefined) {
      updateData.branding = branding;
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        branding: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        logoUrl: updated.logoUrl,
        primaryColor: updated.primaryColor,
        accentColor: updated.accentColor,
        branding: (updated.branding as Record<string, any>) || {},
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to update branding" } }, { status });
  }
}
