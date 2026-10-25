import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/ai/encryption";
import { auditLog } from "@/lib/audit";

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
};

async function safeConfig(config: any) {
  const credential = await prisma.aiProviderCredential.findFirst({ where: { providerConfigId: config.id }, select: { encryptedKey: true } });
  return {
    id: config.id,
    organizationId: config.organizationId,
    name: config.name,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    isEnabled: config.isEnabled,
    isDefault: config.isDefault,
    fallbackProvider: config.fallbackProvider,
    fallbackModel: config.fallbackModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    hasApiKey: Boolean(credential),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function GET() {
  try {
    const user = await requirePermission("ai.configure");
    const configs = await prisma.aiProviderConfig.findMany({
      where: { organizationId: user.organizationId ?? "" },
      orderBy: { updatedAt: "desc" },
      include: { credentials: { select: { id: true, keyHint: true, updatedAt: true } } },
    });
    const safe = configs.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
      isEnabled: c.isEnabled,
      isDefault: c.isDefault,
      fallbackProvider: c.fallbackProvider,
      fallbackModel: c.fallbackModel,
      temperature: c.temperature,
      maxTokens: c.maxTokens,
      timeoutMs: c.timeoutMs,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    return NextResponse.json({ success: true, data: safe });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to load AI providers" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.configure");
    const body = await request.json();
    const provider = body.provider as "openai" | "gemini" | "groq" | "anthropic";
    const apiKey = body.apiKey;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: { message: "API key is required." } }, { status: 400 });
    }
    const config = await prisma.aiProviderConfig.create({
      data: {
        organizationId: user.organizationId ?? "",
        name: body.name ?? `${provider} ${body.model ?? "default"}`,
        provider,
        model: body.model ?? PROVIDER_MODELS[provider]?.[0] ?? "default",
        baseUrl: body.baseUrl,
        isEnabled: body.isEnabled ?? true,
        isDefault: body.isDefault ?? false,
        fallbackProvider: body.fallbackProvider,
        fallbackModel: body.fallbackModel,
        temperature: body.temperature ?? 0.2,
        maxTokens: body.maxTokens ?? 1024,
        timeoutMs: body.timeoutMs ?? 30000,
      },
    });
    const encryptedKey = encryptSecret(apiKey);
    await prisma.aiProviderCredential.create({
      data: {
        organizationId: user.organizationId!,
        providerConfigId: config.id,
        encryptedKey,
        keyHint: apiKey.slice(-4),
      },
    });
    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: "ai.provider_created",
      entityType: "AiProviderConfig",
      entityId: config.id,
      metadata: { provider, model: config.model },
    });
    const credential = await prisma.aiProviderCredential.findFirst({ where: { providerConfigId: config.id }, select: { encryptedKey: true } });
    return NextResponse.json({
      success: true,
      data: { ...config, hasApiKey: Boolean(credential) },
    });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Failed to create AI provider" } }, { status: 400 });
  }
}
