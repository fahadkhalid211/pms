import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/ai/encryption";
import { assertSafeBaseUrl } from "@/lib/ai/providers";
import { logActivity } from "@/lib/audit";

const patchProviderSchema = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional().nullable(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  fallbackProvider: z.string().optional().nullable(),
  fallbackModel: z.string().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("ai.configure");
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const { id } = await params;
    const existingConfig = await prisma.aiProviderConfig.findFirst({
      where: { id, organizationId },
    });
    if (!existingConfig) {
      return NextResponse.json({ success: false, error: { message: "Provider not found." } }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchProviderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: parsed.error.issues[0]?.message ?? "Invalid update payload." } },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // SSRF verification
    if (data.baseUrl) {
      try {
        assertSafeBaseUrl(data.baseUrl);
      } catch (err: any) {
        return NextResponse.json({ success: false, error: { message: err.message } }, { status: 400 });
      }
    }

    if (data.isDefault) {
      await prisma.aiProviderConfig.updateMany({
        where: { organizationId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.aiProviderConfig.update({
      where: { id },
      data: {
        name: data.name,
        model: data.model,
        baseUrl: data.baseUrl,
        isEnabled: data.isEnabled,
        isDefault: data.isDefault,
        fallbackProvider: data.fallbackProvider,
        fallbackModel: data.fallbackModel,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        timeoutMs: data.timeoutMs,
      },
    });

    if (typeof data.apiKey === "string" && data.apiKey.length > 0) {
      const encryptedKey = encryptSecret(data.apiKey);
      const existingCred = await prisma.aiProviderCredential.findFirst({
        where: { providerConfigId: updated.id },
      });
      if (existingCred) {
        await prisma.aiProviderCredential.update({
          where: { id: existingCred.id },
          data: { encryptedKey, keyHint: data.apiKey.slice(-4), keyVersion: existingCred.keyVersion + 1 },
        });
      } else {
        await prisma.aiProviderCredential.create({
          data: {
            organizationId,
            providerConfigId: updated.id,
            encryptedKey,
            keyHint: data.apiKey.slice(-4),
            keyVersion: 1,
          },
        });
      }
    }

    await logActivity({
      organizationId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.roleKey,
      source: "backend",
      category: "ai",
      action: "ai.provider_updated",
      summary: `Updated AI provider '${updated.name}' (${updated.provider}/${updated.model}).`,
      entityType: "AiProviderConfig",
      entityId: updated.id,
    });

    const credential = await prisma.aiProviderCredential.findFirst({
      where: { providerConfigId: updated.id },
      select: { keyHint: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        organizationId: updated.organizationId,
        name: updated.name,
        provider: updated.provider,
        model: updated.model,
        baseUrl: updated.baseUrl,
        isEnabled: updated.isEnabled,
        isDefault: updated.isDefault,
        fallbackProvider: updated.fallbackProvider,
        fallbackModel: updated.fallbackModel,
        temperature: updated.temperature,
        maxTokens: updated.maxTokens,
        timeoutMs: updated.timeoutMs,
        hasApiKey: Boolean(credential),
        keyHint: credential?.keyHint ?? null,
      },
    });
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
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ success: false, error: { message: "Organization context required." } }, { status: 400 });
    }

    const { id } = await params;
    const config = await prisma.aiProviderConfig.findFirst({
      where: { id, organizationId },
    });
    if (!config) {
      return NextResponse.json({ success: false, error: { message: "Provider not found." } }, { status: 404 });
    }

    await prisma.aiProviderConfig.delete({ where: { id } });

    await logActivity({
      organizationId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.roleKey,
      source: "backend",
      category: "ai",
      action: "ai.provider_deleted",
      summary: `Deleted AI provider '${config.name}' (${config.provider}).`,
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
