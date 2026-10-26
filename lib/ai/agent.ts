import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import { decryptSecret } from "@/lib/ai/encryption";
import { resolveUserContext, type SessionUser } from "@/lib/auth/session";
import {
  providerChatCompletion,
  AiRateLimitError,
  AiTimeoutError,
  AiDisabledError,
  AiProviderError,
  type AiMessage,
  type AiProviderConfig,
  type ProviderResult,
} from "./providers";
import { toolsForPermissions, getTool, toolDefinitions, type ToolContext } from "./tools";

const MAX_TURNS = 5;

export interface AgentOutcome {
  executionId: string;
  status: "completed" | "failed" | "awaiting_approval";
  finalContent: string | null;
  approvalId?: string;
  error?: string;
}

/**
 * Resolves an active AI provider for the organization, checking default and fallback.
 */
export async function resolveProvider(organizationId: string, preferredProviderId?: string): Promise<AiProviderConfig | null> {
  const where: Prisma.AiProviderConfigWhereInput = {
    organizationId,
    isEnabled: true,
    ...(preferredProviderId ? { id: preferredProviderId } : {}),
  };

  const config = await prisma.aiProviderConfig.findFirst({
    where,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: { credentials: true },
  });

  if (!config) return null;

  // Mock provider does not strictly require encrypted external key
  let apiKey = "mock-key";
  if (config.provider !== "mock") {
    const cred = config.credentials[0];
    if (!cred) return null;
    apiKey = decryptSecret(cred.encryptedKey);
  }

  return {
    provider: config.provider as AiProviderConfig["provider"],
    model: config.model,
    apiKey,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    fallbackProvider: config.fallbackProvider,
    fallbackModel: config.fallbackModel,
  };
}

/**
 * Resolves a fallback provider configuration when the primary provider encounters
 * rate limits, timeouts, or service errors.
 */
export async function resolveFallbackProvider(organizationId: string, currentConfig: AiProviderConfig): Promise<AiProviderConfig | null> {
  // If fallbackProvider is explicitly named, search for it
  if (currentConfig.fallbackProvider) {
    const fallback = await prisma.aiProviderConfig.findFirst({
      where: {
        organizationId,
        provider: currentConfig.fallbackProvider,
        isEnabled: true,
      },
      include: { credentials: true },
    });
    if (fallback) {
      const apiKey = fallback.provider === "mock" ? "mock-key" : fallback.credentials[0] ? decryptSecret(fallback.credentials[0].encryptedKey) : "mock-key";
      return {
        provider: fallback.provider as AiProviderConfig["provider"],
        model: currentConfig.fallbackModel ?? fallback.model,
        apiKey,
        baseUrl: fallback.baseUrl,
        temperature: fallback.temperature,
        maxTokens: fallback.maxTokens,
        timeoutMs: fallback.timeoutMs,
      };
    }
  }

  // Otherwise pick any other enabled provider
  const alternate = await prisma.aiProviderConfig.findFirst({
    where: {
      organizationId,
      isEnabled: true,
      provider: { not: currentConfig.provider },
    },
    include: { credentials: true },
  });

  if (!alternate) return null;
  const apiKey = alternate.provider === "mock" ? "mock-key" : alternate.credentials[0] ? decryptSecret(alternate.credentials[0].encryptedKey) : "mock-key";
  return {
    provider: alternate.provider as AiProviderConfig["provider"],
    model: alternate.model,
    apiKey,
    baseUrl: alternate.baseUrl,
    temperature: alternate.temperature,
    maxTokens: alternate.maxTokens,
    timeoutMs: alternate.timeoutMs,
  };
}

/**
 * Dispatches an AI chat completion with automatic fallback support.
 */
async function callWithFallbackChain(
  organizationId: string,
  primaryConfig: AiProviderConfig,
  messages: AiMessage[],
  tools: any[],
  systemPrompt: string,
): Promise<ProviderResult> {
  try {
    return await providerChatCompletion(primaryConfig, messages, tools, systemPrompt);
  } catch (err: unknown) {
    const isRetryable = err instanceof AiRateLimitError || err instanceof AiTimeoutError || (err instanceof AiProviderError && err.retryable);
    if (!isRetryable) throw err;

    // Attempt fallback
    const fallbackConfig = await resolveFallbackProvider(organizationId, primaryConfig);
    if (!fallbackConfig) throw err;

    await logActivity({
      organizationId,
      source: "backend",
      category: "ai",
      action: "ai.provider_fallback",
      summary: `Primary provider ${primaryConfig.provider} failed (${(err as Error).message}). Switched to fallback provider ${fallbackConfig.provider}.`,
    });

    return await providerChatCompletion(fallbackConfig, messages, tools, systemPrompt);
  }
}

/**
 * Main Autonomous AI Operations Agent.
 * Runs multi-turn tool dispatch, enforces RBAC + property scope,
 * detects sensitive operations and queues human-in-the-loop approvals.
 */
export async function runAgent(input: {
  message: string;
  userId: string;
  organizationId: string;
  propertyId?: string | null;
  executionId?: string;
}): Promise<AgentOutcome> {
  // Check if AI is enabled for the organization
  const primaryConfig = await resolveProvider(input.organizationId);
  if (!primaryConfig) {
    throw new AiDisabledError("AI capabilities are not configured or are disabled for this organization.");
  }

  // Create or retrieve execution record
  const execution = input.executionId
    ? await prisma.aiAgentExecution.findFirst({
        where: { id: input.executionId, organizationId: input.organizationId },
      })
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

  const sessionUser = await resolveUserContext(input.userId);
  if (!sessionUser) {
    throw new Error("User context could not be resolved.");
  }

  // Verify multi-tenant integrity
  if (sessionUser.organizationId !== input.organizationId) {
    throw new Error("Cross-tenant violation: user does not belong to the target organization.");
  }

  const allowedTools = toolsForPermissions(sessionUser);
  const toolDefs = toolDefinitions(allowedTools);

  const messages: AiMessage[] = [
    {
      role: "system",
      content:
        "You are the Lumina PMS autonomous operations agent. You assist hotel managers and staff in reservations, front desk, housekeeping, maintenance, billing, and operational reports. Use only available tools. Sensitive actions like cancellations and refunds will be forwarded for supervisor approval. Be concise, precise, and polite.",
    },
    { role: "user", content: input.message },
  ];

  let finalContent: string | null = null;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const result = await callWithFallbackChain(
        input.organizationId,
        primaryConfig,
        messages,
        toolDefs,
        "You are the Lumina PMS operations agent.",
      );

      // No tool calls requested: LLM produced final response
      if (result.toolCalls.length === 0) {
        finalContent = result.content;
        break;
      }

      messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });

      for (const tc of result.toolCalls) {
        const tool = getTool(tc.name);

        // Tool does not exist or user lacks permission
        const isPermitted =
          tool &&
          (sessionUser.roleKey === "admin" ||
            !tool.requiresPermission ||
            sessionUser.permissions.includes(tool.requiresPermission));

        if (!tool || !isPermitted) {
          messages.push({
            role: "user",
            content: `Permission denied: you are not authorized to execute tool '${tc.name}'.`,
            toolCallId: tc.id,
          });
          continue;
        }

        // Validate tool arguments against Zod schema
        const parseResult = tool.schema.safeParse(tc.arguments);
        if (!parseResult.success) {
          messages.push({
            role: "user",
            content: `Invalid arguments for tool '${tc.name}': ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
            toolCallId: tc.id,
          });
          continue;
        }

        const validArgs = parseResult.data;

        // Verify property scope if user is restricted
        if (
          sessionUser.propertyIds &&
          sessionUser.propertyIds.length > 0 &&
          validArgs.propertyId &&
          !sessionUser.propertyIds.includes(validArgs.propertyId)
        ) {
          messages.push({
            role: "user",
            content: `Access denied: you do not have permission to operate on property '${validArgs.propertyId}'.`,
            toolCallId: tc.id,
          });
          continue;
        }

        // Human-in-the-loop approval gate for sensitive tools
        if (tool.risk === "sensitive" || tool.requiresApproval) {
          const approvalSummary = `AI agent requested to run '${tool.name}' with input: ${JSON.stringify(validArgs)}.`;

          const approval = await prisma.approvalRequest.create({
            data: {
              organizationId: input.organizationId,
              userId: input.userId,
              executionId: execution.id,
              toolName: tool.name,
              action: tool.name,
              summary: approvalSummary,
              details: { toolName: tool.name, args: validArgs } as Prisma.InputJsonObject,
              status: "pending",
              expiresAt: new Date(Date.now() + 86400000 * 2), // 48h
            },
          });

          await prisma.aiToolExecution.create({
            data: {
              organizationId: input.organizationId,
              executionId: execution.id,
              toolName: tool.name,
              input: validArgs as Prisma.InputJsonObject,
              status: "pending",
              approvalRequestId: approval.id,
            },
          });

          await prisma.aiAgentExecution.update({
            where: { id: execution.id },
            data: { status: "awaiting_approval" },
          });

          await logActivity({
            organizationId: input.organizationId,
            propertyId: input.propertyId,
            userId: input.userId,
            userName: sessionUser.name,
            userEmail: sessionUser.email,
            userRole: sessionUser.roleKey,
            source: "backend",
            category: "ai",
            action: "ai.approval_requested",
            summary: `Approval requested for sensitive action '${tool.name}' (Approval #${approval.id.slice(0, 8)}).`,
            entityType: "ApprovalRequest",
            entityId: approval.id,
            metadata: { toolName: tool.name, executionId: execution.id },
          });

          return {
            executionId: execution.id,
            status: "awaiting_approval",
            finalContent: null,
            approvalId: approval.id,
          };
        }

        // Non-sensitive: execute tool directly
        const toolCtx: ToolContext = {
          user: sessionUser,
          actorUserId: input.userId,
          organizationId: input.organizationId,
          propertyId: input.propertyId ?? null,
        };

        const toolResult = await tool.run(toolCtx, validArgs);

        await prisma.aiToolExecution.create({
          data: {
            organizationId: input.organizationId,
            executionId: execution.id,
            toolName: tool.name,
            input: validArgs as Prisma.InputJsonObject,
            output: { result: toolResult.content, data: toolResult.data } as Prisma.InputJsonObject,
            status: "succeeded",
          },
        });

        messages.push({ role: "user", content: toolResult.content, toolCallId: tc.id });
      }
    }

    await prisma.aiAgentExecution.update({
      where: { id: execution.id },
      data: {
        status: "completed",
        finalSummary: finalContent ?? "Task processed by AI agent.",
        finishedAt: new Date(),
      },
    });

    await logActivity({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      userId: input.userId,
      userName: sessionUser.name,
      userEmail: sessionUser.email,
      userRole: sessionUser.roleKey,
      source: "backend",
      category: "ai",
      action: "ai.execution_completed",
      summary: `AI agent execution completed successfully: ${(finalContent ?? "Done").slice(0, 80)}`,
      entityType: "AiAgentExecution",
      entityId: execution.id,
    });

    return {
      executionId: execution.id,
      status: "completed",
      finalContent: finalContent ?? "Task completed.",
    };
  } catch (error: unknown) {
    const err = error as Error;
    await prisma.aiAgentExecution.update({
      where: { id: execution.id },
      data: {
        status: "failed",
        error: err.message ?? "Agent execution failed",
        finishedAt: new Date(),
      },
    });

    await logActivity({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      userId: input.userId,
      userName: sessionUser.name,
      userEmail: sessionUser.email,
      userRole: sessionUser.roleKey,
      source: "backend",
      category: "ai",
      action: "ai.execution_failed",
      summary: `AI agent execution failed: ${err.message}`,
      entityType: "AiAgentExecution",
      entityId: execution.id,
    });

    return {
      executionId: execution.id,
      status: "failed",
      finalContent: null,
      error: err.message ?? "Agent execution failed",
    };
  }
}

/**
 * Approve a pending AI action.
 * Re-validates approver permissions, verifies multi-tenancy, executes tool, and completes agent execution.
 */
export async function approveAiExecution(input: {
  approvalId: string;
  approver: SessionUser;
  comment?: string;
}): Promise<{ ok: boolean; result: string }> {
  // Re-verify approver permission
  const hasApprovePerm =
    input.approver.roleKey === "admin" ||
    (input.approver.permissions && input.approver.permissions.includes("ai.approve"));

  if (!hasApprovePerm) {
    throw new Error("Forbidden: user lacks 'ai.approve' permission.");
  }

  const organizationId = input.approver.organizationId;
  if (!organizationId) {
    throw new Error("Approver organization context is missing.");
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { id: input.approvalId, organizationId },
    include: { execution: true, toolExecutions: true },
  });

  if (!approval) {
    throw new Error("Approval request not found in your organization.");
  }

  if (approval.status !== "pending") {
    throw new Error(`Approval request is already in '${approval.status}' state.`);
  }

  const tool = getTool(approval.toolName);
  if (!tool) {
    throw new Error(`Tool '${approval.toolName}' is no longer registered in the system.`);
  }

  const details = approval.details as Record<string, unknown> | null;
  const toolArgs = (details?.args ?? {}) as Record<string, unknown>;

  const toolCtx: ToolContext = {
    user: input.approver,
    actorUserId: input.approver.id,
    organizationId,
    propertyId: typeof toolArgs.propertyId === "string" ? toolArgs.propertyId : null,
  };

  // Run the approved action with approver authority
  const runResult = await tool.run(toolCtx, toolArgs);

  await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: {
      status: "executed",
      decidedBy: input.approver.id,
      decidedAt: new Date(),
    },
  });

  const toolExec = approval.toolExecutions[0];
  if (toolExec) {
    await prisma.aiToolExecution.update({
      where: { id: toolExec.id },
      data: {
        status: "succeeded",
        output: { result: runResult.content, data: runResult.data } as Prisma.InputJsonObject,
        updatedAt: new Date(),
      },
    });
  }

  if (approval.executionId) {
    await prisma.aiAgentExecution.update({
      where: { id: approval.executionId },
      data: {
        status: "completed",
        finalSummary: runResult.content,
        finishedAt: new Date(),
      },
    });
  }

  await logActivity({
    organizationId,
    propertyId: toolCtx.propertyId,
    userId: input.approver.id,
    userName: input.approver.name,
    userEmail: input.approver.email,
    userRole: input.approver.roleKey,
    source: "backend",
    category: "ai",
    action: "ai.approval_executed",
    summary: `Approved and executed sensitive action '${approval.toolName}' (Approval #${approval.id.slice(0, 8)}).`,
    entityType: "ApprovalRequest",
    entityId: approval.id,
    metadata: { toolName: approval.toolName, executionId: approval.executionId, comment: input.comment },
  });

  return { ok: true, result: runResult.content };
}

/**
 * Reject a pending AI action.
 * Marks approval rejected, flags tool execution as rejected, and terminates agent execution.
 */
export async function rejectAiExecution(input: {
  approvalId: string;
  approver: SessionUser;
  reason?: string;
}): Promise<{ ok: boolean; status: string }> {
  const hasApprovePerm =
    input.approver.roleKey === "admin" ||
    (input.approver.permissions && input.approver.permissions.includes("ai.approve"));

  if (!hasApprovePerm) {
    throw new Error("Forbidden: user lacks 'ai.approve' permission.");
  }

  const organizationId = input.approver.organizationId;
  if (!organizationId) {
    throw new Error("Approver organization context is missing.");
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { id: input.approvalId, organizationId },
    include: { execution: true, toolExecutions: true },
  });

  if (!approval) {
    throw new Error("Approval request not found in your organization.");
  }

  if (approval.status !== "pending") {
    throw new Error(`Approval request is already in '${approval.status}' state.`);
  }

  const rejectionReason = input.reason ?? "Rejected by manager";

  await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: {
      status: "rejected",
      decidedBy: input.approver.id,
      decidedAt: new Date(),
    },
  });

  const toolExec = approval.toolExecutions[0];
  if (toolExec) {
    await prisma.aiToolExecution.update({
      where: { id: toolExec.id },
      data: {
        status: "rejected",
        output: { rejectionReason } as Prisma.InputJsonObject,
        updatedAt: new Date(),
      },
    });
  }

  if (approval.executionId) {
    await prisma.aiAgentExecution.update({
      where: { id: approval.executionId },
      data: {
        status: "failed",
        error: `Action rejected: ${rejectionReason}`,
        finishedAt: new Date(),
      },
    });
  }

  await logActivity({
    organizationId,
    userId: input.approver.id,
    userName: input.approver.name,
    userEmail: input.approver.email,
    userRole: input.approver.roleKey,
    source: "backend",
    category: "ai",
    action: "ai.approval_rejected",
    summary: `Rejected AI action '${approval.toolName}' (Approval #${approval.id.slice(0, 8)}): ${rejectionReason}.`,
    entityType: "ApprovalRequest",
    entityId: approval.id,
    metadata: { toolName: approval.toolName, executionId: approval.executionId, reason: rejectionReason },
  });

  return { ok: true, status: "rejected" };
}
