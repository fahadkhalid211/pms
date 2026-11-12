import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { saveIntegrationCredentials } from "@/lib/integrations";
import { syncHospitableTwoWay } from "@/lib/integrations/hospitable";

const syncSchema = z.object({
  integrationId: z.string().optional(),
  accessToken: z.string().trim().min(10).optional(),
  webhookSecret: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission("integrations.manage");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization required" } }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid request payload" } },
        { status: 400 },
      );
    }

    let integration = parsed.data.integrationId
      ? await prisma.integration.findFirst({
          where: { id: parsed.data.integrationId, organizationId, provider: "hospitable" },
        })
      : await prisma.integration.findFirst({
          where: { organizationId, provider: "hospitable" },
          orderBy: { updatedAt: "desc" },
        });

    if (parsed.data.accessToken) {
      if (!integration) {
        integration = await prisma.integration.create({
          data: {
            organizationId,
            provider: "hospitable",
            name: "Hospitable Two-Way Sync",
            status: "connected",
            config: { authMode: "pat" },
          },
        });
      }

      const credsToSave: Record<string, string> = {
        accessToken: parsed.data.accessToken,
      };
      if (parsed.data.webhookSecret) {
        credsToSave.webhookSecret = parsed.data.webhookSecret;
      }

      await saveIntegrationCredentials({
        organizationId,
        integrationId: integration.id,
        credentials: credsToSave,
      });
    }

    if (!integration) {
      return NextResponse.json(
        { success: false, error: { message: "Hospitable is not connected yet. Sign in or provide a Personal Access Token." } },
        { status: 404 },
      );
    }

    const summary = await syncHospitableTwoWay({
      organizationId,
      integrationId: integration.id,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        integrationId: integration.id,
        summary,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Hospitable sync failed" } }, { status: 400 });
  }
}
