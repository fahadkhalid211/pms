import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { decryptSecret } from "@/lib/ai/encryption";
import { resolveUserContext } from "@/lib/auth/session";
import { providerChatCompletion, type AiMessage, type AiProviderConfig } from "./providers";
import { toolsForPermissions, type ToolContext } from "./tools";

const MAX_STEPS = 6;

export interface AgentOutcome {
  executionId: string;
  status: "completed" | "failed" | "awaiting_approval";
  finalContent: string | null;
  approvalId?: string;
  error?: string;
}

export async function runAgent(input: {
  message: string;
  userId: string;
  organizationId: string;
  propertyId?: string | null;
  executionId?: string;
}): Promise<AgentOutcome> {
  const execution = input.executionId
    ? await prisma.aiAgentExecution.findUnique({ where: { id: input.executionId } })
    : await prisma.aiAgentExecution.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          propertyId: input.propertyId ?? null,
          status: "running",
          requestSummary: input.message,
          startedAt: new Date(),
        },
      });

  if (!execution) {
    return { executionId: "", status: "failed", finalContent: null, error: "Execution record not found." };
  }

  if (execution.status === "awaiting_approval") {
    return { executionId: execution.id, status: "awaiting_approval", finalContent: null };
  }

  try {
    const config = await resolveProvider(input.organizationId);
    if (!config) {
      throw new Error("No AI provider configured for this organization. Configure one in AI Providers.");
    }

    const sessionUser = await resolveUserContext(input.userId);
    if (!sessionUser) {
      throw new Error("User context could not be resolved.");
    }

    const allowedTools = toolsForPermissions(sessionUser);
    const toolDefs = allowedTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object",
        properties: {
          propertyId: { type: "string" },
          roomId: { type: "string" },
          roomIds: { type: "array", items: { type: "string" } },
          reservationId: { type: "string" },
          checkIn: { type: "string" },
          checkOut: { type: "string" },
          adults: { type: "number" },
          children: { type: "number" },
          guestId: { type: "string" },
          status: { type: "string" },
          source: { type: "string" },
          notes: { type: "string" },
          priority: { type: "string" },
          title: { type: "string" },
          dueInHours: { type: "number" },
          query: { type: "string" },
          description: { type: "string" },
          reportType: { type: "string" },
          tone: { type: "string" },
        },
        required: [],
        additionalProperties: true,
      },
    }));

    const messages: AiMessage[] = [
      { role: "system", content: "You are the Lumina PMS autonomous operations agent. You help hotel staff run reservations, front desk, housekeeping, billing, and operational summaries using authorized tools. When a request needs an action, call the appropriate tool. When uncertain, ask a clarifying question." },
      { role: "user", content: input.message },
    ];

    let finalContent: string | null = null;

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const result = await providerChatCompletion(config, messages, toolDefs, "You are the Lumina PMS autonomous operations agent.");
      if (result.toolCalls.length === 0) {
        finalContent = result.content;
        break;
      }
      messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });
      for (const tc of result.toolCalls) {
        const allowedTool = allowedTools.find((t) => t.name === tc.name);
        const permitted = allowedTool
          ? !allowedTool.requiresPermission || sessionUser.permissions.includes(allowedTool.requiresPermission) || sessionUser.roleKey === "admin"
          : false;
        const ctx: ToolContext = {
          user: sessionUser,
          actorUserId: input.userId,
          organizationId: input.organizationId,
          propertyId: input.propertyId ?? null,
        };
        if (!permitted) {
          messages.push({ role: "user", content: `You are not permitted to use tool ${tc.name}.`, toolCallId: tc.id });
          continue;
        }
        if (allowedTool!.requiresApproval) {
          const approval = await prisma.approvalRequest.create({
            data: {
              organizationId: input.organizationId,
              userId: input.userId,
              executionId: execution.id,
              toolName: tc.name,
              action: tc.name,
              summary: `AI agent requested to run tool ${tc.name} with args ${JSON.stringify(tc.arguments)}.`,
              details: { toolName: tc.name, args: (tc.arguments ?? {}) as Prisma.InputJsonObject },
              status: "pending",
              expiresAt: new Date(Date.now() + 86400000),
            },
          });
          await prisma.aiToolExecution.create({
            data: {
              organizationId: input.organizationId,
              executionId: execution.id,
              toolName: tc.name,
              input: (tc.arguments ?? {}) as Prisma.InputJsonObject,
              status: "pending",
              approvalRequestId: approval.id,
            },
          });
          await prisma.aiAgentExecution.update({ where: { id: execution.id }, data: { status: "awaiting_approval" } });
          await auditLog({
            userId: input.userId,
            organizationId: input.organizationId,
            action: "ai.approval_requested",
            entityType: "AiAgentExecution",
            entityId: execution.id,
            metadata: { toolName: tc.name, approvalId: approval.id },
          });
          return { executionId: execution.id, status: "awaiting_approval", finalContent: null, approvalId: approval.id };
        }
        const toolResult = await allowedTool!.run(ctx, tc.arguments ?? {});
        await prisma.aiToolExecution.create({
          data: {
            organizationId: input.organizationId,
            executionId: execution.id,
            toolName: tc.name,
            input: (tc.arguments ?? {}) as Prisma.InputJsonObject,
            output: { result: toolResult.content } as Prisma.InputJsonObject,
            status: "succeeded",
          },
        });
        messages.push({ role: "user", content: toolResult.content, toolCallId: tc.id });
      }
    }

    await prisma.aiAgentExecution.update({
      where: { id: execution.id },
      data: { status: "completed", finalSummary: finalContent, finishedAt: new Date() },
    });
    return { executionId: execution.id, status: "completed", finalContent };
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.aiAgentExecution.update({
      where: { id: execution.id },
      data: { status: "failed", error: err?.message ?? "Agent execution failed", finishedAt: new Date() },
    });
    return { executionId: execution.id, status: "failed", finalContent: null, error: err?.message ?? "Agent execution failed" };
  }
}

async function resolveProvider(organizationId: string): Promise<AiProviderConfig | null> {
  const config = await prisma.aiProviderConfig.findFirst({
    where: { organizationId, isEnabled: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  if (!config) return null;
  const credential = await prisma.aiProviderCredential.findFirst({ where: { providerConfigId: config.id } });
  if (!credential) return null;
  const apiKey = decryptSecret(credential.encryptedKey);
  const resolved: AiProviderConfig = {
    provider: config.provider as AiProviderConfig["provider"],
    model: config.model,
    apiKey,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
  };
  return resolved;
}
