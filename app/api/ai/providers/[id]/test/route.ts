import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/ai/encryption";
import { fetchProviderModels } from "@/lib/ai/providers";
import { logActivity } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.configure");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const { id } = await params;
    const config = await prisma.aiProviderConfig.findFirst({
      where: { id, organizationId },
      include: { credentials: true },
    });

    if (!config) {
      return NextResponse.json({ success: false, error: { message: "Provider configuration not found." } }, { status: 404 });
    }

    let apiKey = "mock-key";
    if (config.provider !== "mock") {
      if (!config.credentials?.length) {
        return NextResponse.json({ success: false, error: { message: "Provider credentials not found." } }, { status: 400 });
      }
      apiKey = decryptSecret(config.credentials[0].encryptedKey);
    }

    const resolved = {
      provider: config.provider as any,
      model: config.model,
      apiKey,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    };

    const models = await fetchProviderModels(resolved);

    await logActivity({
      organizationId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.roleKey,
      source: "backend",
      category: "ai",
      action: "ai.provider_test",
      summary: `Tested AI provider '${config.name}': ping succeeded, discovered ${models.length} model(s).`,
      entityType: "AiProviderConfig",
      entityId: config.id,
      metadata: { provider: config.provider, modelCount: models.length },
    });

    return NextResponse.json({ success: true, data: { ok: true, models } });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "AI provider test failed" } }, { status: 500 });
  }
}
