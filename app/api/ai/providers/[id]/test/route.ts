import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/ai/encryption";
import { fetchProviderModels } from "@/lib/ai/providers";
import { auditLog } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.configure");
    const { id } = await params;
    const config = await prisma.aiProviderConfig.findFirst({
      where: { id, organizationId: user.organizationId ?? "" },
      include: { credentials: true },
    });
    if (!config || !config.credentials?.length) {
      return NextResponse.json({ success: false, error: { message: "Provider credentials not found." } }, { status: 404 });
    }
    const resolved = {
      provider: config.provider as "openai" | "gemini" | "groq" | "anthropic",
      model: config.model,
      apiKey: decryptSecret(config.credentials[0].encryptedKey),
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    };
    const models = await fetchProviderModels(resolved);
    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: "ai.provider_test",
      entityType: "AiProviderConfig",
      entityId: config.id,
      metadata: { provider: config.provider, model: config.model, modelCount: models.length },
    });
    return NextResponse.json({ success: true, data: { ok: true, models } });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "AI provider test failed" } }, { status: 500 });
  }
}
