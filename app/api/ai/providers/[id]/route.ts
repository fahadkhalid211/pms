import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/ai/encryption";
import { auditLog } from "@/lib/audit";

interface ConfigRecord {
  id: string;
  organizationId: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
}

async function safeConfig(config: ConfigRecord) {
  const credential = await prisma.aiProviderCredential.findFirst({
    where: { providerConfigId: config.id },
    select: { encryptedKey: true },
  });
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.configure");
    const { id } = await params;
    const existingConfig = await prisma.aiProviderConfig.findFirst({
      where: { id, organizationId: user.organizationId ?? "" },
    });
    if (!existingConfig) {
      return NextResponse.json({ success: false, error: { message: "Provider not found." } }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const config = await prisma.aiProviderConfig.update({
      where: { id },
      data: {
        name: typeof body.name === "string" ? body.name : undefined,
        model: typeof body.model === "string" ? body.model : undefined,
        baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
        isEnabled: typeof body.isEnabled === "boolean" ? body.isEnabled : undefined,
        isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
        fallbackProvider: typeof body.fallbackProvider === "string" ? body.fallbackProvider : undefined,
        fallbackModel: typeof body.fallbackModel === "string" ? body.fallbackModel : undefined,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      },
    });
    if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
      const encryptedKey = encryptSecret(body.apiKey);
      const existingCred = await prisma.aiProviderCredential.findFirst({
        where: { providerConfigId: config.id },
      });
      if (existingCred) {
        await prisma.aiProviderCredential.update({
          where: { id: existingCred.id },
          data: { encryptedKey, keyHint: body.apiKey.slice(-4) },
        });
      } else {
        await prisma.aiProviderCredential.create({
          data: {
            organizationId: user.organizationId!,
            providerConfigId: config.id,
            encryptedKey,
            keyHint: body.apiKey.slice(-4),
          },
        });
      }
    }
    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: "ai.provider_updated",
      entityType: "AiProviderConfig",
      entityId: config.id,
      metadata: { name: config.name, provider: config.provider },
    });
    const safe = await safeConfig(config);
    return NextResponse.json({ success: true, data: safe });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to update AI provider" } }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.configure");
    const { id } = await params;
    const config = await prisma.aiProviderConfig.findFirst({
      where: { id, organizationId: user.organizationId ?? "" },
    });
    if (!config) return NextResponse.json({ success: false, error: { message: "Provider not found." } }, { status: 404 });
    await prisma.aiProviderConfig.delete({ where: { id } });
    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: "ai.provider_deleted",
      entityType: "AiProviderConfig",
      entityId: config.id,
    });
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 403) return NextResponse.json({ success: false, error: { message: err.message ?? "Forbidden" } }, { status: 403 });
    if (err?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: err?.message ?? "Failed to delete AI provider" } }, { status: 500 });
  }
}
