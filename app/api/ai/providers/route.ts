import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/ai/encryption";
import { assertSafeBaseUrl } from "@/lib/ai/providers";
import { logActivity } from "@/lib/audit";

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  mock: ["mock-operations-v1", "mock-fast-v1"],
};

const createProviderSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.enum(["openai", "gemini", "groq", "anthropic", "mock"]),
  model: z.string().min(1),
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  fallbackProvider: z.string().optional().nullable(),
  fallbackModel: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().default(1024),
  timeoutMs: z.number().int().positive().default(30000),
  capabilities: z.record(z.unknown()).optional(),
});

export async function GET() {
  try {
    const user = await requirePermission("ai.configure");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const configs = await prisma.aiProviderConfig.findMany({
      where: { organizationId },
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
      hasApiKey: c.credentials.length > 0,
      keyHint: c.credentials[0]?.keyHint ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json({ success: true, data: safe });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to load AI providers" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("ai.configure");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createProviderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid configuration." } },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (data.provider !== "mock" && !data.apiKey) {
      return NextResponse.json({ success: false, error: { message: "API key is required for real providers." } }, { status: 400 });
    }

    // SSRF validation
    if (data.baseUrl) {
      try {
        assertSafeBaseUrl(data.baseUrl);
      } catch (err: any) {
        return NextResponse.json({ success: false, error: { message: err.message } }, { status: 400 });
      }
    }

    // If marked default, unset other defaults
    if (data.isDefault) {
      await prisma.aiProviderConfig.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const config = await prisma.aiProviderConfig.create({
      data: {
        organizationId,
        name: data.name ?? `${data.provider.toUpperCase()} (${data.model})`,
        provider: data.provider,
        model: data.model || PROVIDER_MODELS[data.provider]?.[0] || "default",
        baseUrl: data.baseUrl ?? null,
        isEnabled: data.isEnabled,
        isDefault: data.isDefault,
        fallbackProvider: data.fallbackProvider ?? null,
        fallbackModel: data.fallbackModel ?? null,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        timeoutMs: data.timeoutMs,
      },
    });

    if (data.apiKey) {
      const encryptedKey = encryptSecret(data.apiKey);
      await prisma.aiProviderCredential.create({
        data: {
          organizationId,
          providerConfigId: config.id,
          encryptedKey,
          keyHint: data.apiKey.slice(-4),
        },
      });
    }

    await logActivity({
      organizationId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.roleKey,
      source: "backend",
      category: "ai",
      action: "ai.provider_created",
      summary: `Created AI provider '${config.name}' (${config.provider}/${config.model}).`,
      entityType: "AiProviderConfig",
      entityId: config.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        organizationId: config.organizationId,
        name: config.name,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        isEnabled: config.isEnabled,
        isDefault: config.isDefault,
        hasApiKey: Boolean(data.apiKey),
        keyHint: data.apiKey ? data.apiKey.slice(-4) : null,
      },
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to create AI provider" } }, { status: 500 });
  }
}
