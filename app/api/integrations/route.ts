import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { saveIntegrationCredentials, SUPPORTED_INTEGRATIONS } from "@/lib/integrations";
import { logActivity } from "@/lib/audit";

export async function GET() {
  try {
    const user = await requirePermission("integrations.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const [integrations, recentWebhooks, properties] = await Promise.all([
      prisma.integration.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { property: { select: { id: true, name: true } } },
      }),
      prisma.webhookEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.property.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        integrations,
        recentWebhooks,
        properties,
        supportedCatalogue: SUPPORTED_INTEGRATIONS,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load integrations" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("integrations.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json();
    const { provider, name, propertyId, credentials, config } = body;

    if (!provider || !name) {
      return NextResponse.json({ success: false, error: { message: "Provider and name are required." } }, { status: 400 });
    }

    // Upsert or create integration
    const integration = await prisma.integration.create({
      data: {
        organizationId,
        propertyId: propertyId || null,
        provider,
        name,
        status: credentials && Object.keys(credentials).length > 0 ? "connected" : "pending_config",
        config: config || undefined,
      },
    });

    if (credentials && Object.keys(credentials).length > 0) {
      await saveIntegrationCredentials({
        organizationId,
        integrationId: integration.id,
        credentials,
      });
    }

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "operations",
      action: "integration.configured",
      summary: `Configured integration '${name}' (${provider}).`,
      entityType: "Integration",
      entityId: integration.id,
    });

    return NextResponse.json({ success: true, data: integration }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to create integration" } }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requirePermission("integrations.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "Integration ID is required." } }, { status: 400 });
    }

    await prisma.integration.delete({
      where: { id, organizationId },
    });

    await logActivity({
      organizationId,
      userId: user.id,
      source: "backend",
      category: "operations",
      action: "integration.disconnected",
      summary: `Disconnected and removed integration #${id}.`,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to delete integration" } }, { status: 500 });
  }
}
