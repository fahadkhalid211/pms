import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { providerChatCompletion, type AiProviderConfig } from "@/lib/ai/providers";
import { decryptSecret } from "@/lib/ai/encryption";
import { auditLog } from "@/lib/audit";

const SYSTEM_PROMPT = "You are the Lumina PMS guest support assistant. Answer hospitality questions using the provided property context. Never invent policies, prices, or availability. If unsure, say so and offer to connect the guest with a human agent.";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("support.manage");
    const body = await request.json();
    const message: string = body.message;
    const propertyId = body.propertyId ?? null;
    const sessionKey: string = body.sessionKey ?? `guest-${Date.now().toString(36)}`;
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: user.organizationId ?? "" } });

    const conversation = await prisma.chatbotConversation.upsert({
      where: { sessionKey },
      update: { updatedAt: new Date() },
      create: { organizationId: user.organizationId ?? "", propertyId: propertyId ?? undefined, sessionKey },
    });

    await prisma.chatbotMessage.create({
      data: {
        organizationId: conversation.organizationId,
        conversationId: conversation.id,
        role: "user",
        content: message,
      },
    });

    const config = await prisma.aiProviderConfig.findFirst({ where: { organizationId: user.organizationId ?? "", isEnabled: true } });
    let reply: string;
    if (config) {
      const credential = await prisma.aiProviderCredential.findFirst({ where: { providerConfigId: config.id } });
      const resolved: AiProviderConfig = {
        provider: config.provider as AiProviderConfig["provider"],
        model: config.model,
        apiKey: credential ? decryptSecret(credential.encryptedKey) : "",
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeoutMs: config.timeoutMs,
      };
      const contextDocs = await prisma.knowledgeBaseDocument.findMany({
        where: { organizationId: user.organizationId ?? "", status: "active", ...(propertyId ? { propertyId } : {}) },
        take: 5,
        orderBy: { updatedAt: "desc" },
      });
      const context = contextDocs.map((d) => `${d.title}: ${d.content}`).join("\n");
      const result = await providerChatCompletion(
        resolved,
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Property: ${property?.name ?? "Unknown"}. Context: ${context}\n\nGuest question: ${message}` },
        ],
        [],
        SYSTEM_PROMPT,
      );
      reply = result.content ?? "I could not generate a response right now.";
    } else {
      reply = "I am currently unavailable because no AI provider is configured. Please contact the front desk.";
    }

    await prisma.chatbotMessage.create({
      data: {
        organizationId: conversation.organizationId,
        conversationId: conversation.id,
        role: "assistant",
        content: reply,
      },
    });
    await prisma.chatbotConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    await auditLog({
      userId: user.id,
      organizationId: user.organizationId ?? undefined,
      propertyId: propertyId ?? undefined,
      action: "chatbot.message",
      entityType: "ChatbotConversation",
      entityId: conversation.id,
      metadata: { sessionKey, replyLength: reply.length },
    });

    return NextResponse.json({ success: true, data: { reply, sessionKey } });
  } catch (error: any) {
    if (error?.status === 403) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 403 });
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    return NextResponse.json({ success: false, error: { message: error?.message ?? "Chatbot failed" } }, { status: 500 });
  }
}
