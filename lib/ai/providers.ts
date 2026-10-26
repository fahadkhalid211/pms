// Provider-agnostic AI adapter with OpenAI/Gemini/Groq/Anthropic/Mock implementations
// and normalized tool-calling message history, fallback chain, timeouts, token limits,
// error taxonomy, usage/latency/cost tracking, and SSRF protection.

export type AiProviderId = "openai" | "gemini" | "groq" | "anthropic" | "mock";

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | null;
  toolCalls?: AiToolCall[];
  toolCallId?: string;
}

export interface AiProviderConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  fallbackProvider?: string | null;
  fallbackModel?: string | null;
}

export interface AiUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}

export interface ProviderResult {
  content: string | null;
  toolCalls: AiToolCall[];
  usage?: AiUsageStats;
  providerUsed?: string;
  modelUsed?: string;
}

export interface AiToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error Taxonomy
// ---------------------------------------------------------------------------

export class AiProviderError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { code?: string; provider?: string; status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.code = options.code ?? "AI_PROVIDER_ERROR";
    this.provider = options.provider ?? "unknown";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export class AiRateLimitError extends AiProviderError {
  constructor(message: string, provider: string) {
    super(message, { code: "AI_RATE_LIMIT", provider, status: 429, retryable: true });
    this.name = "AiRateLimitError";
  }
}

export class AiTimeoutError extends AiProviderError {
  constructor(message: string, provider: string) {
    super(message, { code: "AI_TIMEOUT", provider, status: 408, retryable: true });
    this.name = "AiTimeoutError";
  }
}

export class AiAuthenticationError extends AiProviderError {
  constructor(message: string, provider: string) {
    super(message, { code: "AI_AUTHENTICATION_ERROR", provider, status: 401, retryable: false });
    this.name = "AiAuthenticationError";
  }
}

export class AiDisabledError extends AiProviderError {
  constructor(message = "AI capabilities are currently disabled for this organization.") {
    super(message, { code: "AI_DISABLED", provider: "system", status: 403, retryable: false });
    this.name = "AiDisabledError";
  }
}

// ---------------------------------------------------------------------------
// Pricing & Cost Estimation ($ per 1M tokens)
// ---------------------------------------------------------------------------

const TOKEN_RATES: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o": { prompt: 2.5, completion: 10.0 },
  "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "gpt-4.1-mini": { prompt: 0.2, completion: 0.8 },
  "gemini-2.0-flash": { prompt: 0.1, completion: 0.4 },
  "gemini-1.5-pro": { prompt: 1.25, completion: 5.0 },
  "llama-3.3-70b-versatile": { prompt: 0.59, completion: 0.79 },
  "mixtral-8x7b-32768": { prompt: 0.24, completion: 0.24 },
  "claude-3-5-sonnet-20241022": { prompt: 3.0, completion: 15.0 },
  "claude-3-haiku-20240307": { prompt: 0.25, completion: 1.25 },
};

export function estimateTokenCost(model: string, promptTokens: number, completionTokens: number): number {
  const matched = TOKEN_RATES[model] ?? { prompt: 0.5, completion: 1.5 };
  const cost = (promptTokens / 1_000_000) * matched.prompt + (completionTokens / 1_000_000) * matched.completion;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// SSRF Defense
// ---------------------------------------------------------------------------

export function assertSafeBaseUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid AI provider baseUrl: malformed URL.");
  }

  const hostname = url.hostname.toLowerCase();

  // Cloud metadata services protection
  if (
    hostname === "169.254.169.254" ||
    hostname.includes("metadata.google.internal") ||
    hostname.includes("metadata.azure.com") ||
    hostname.startsWith("169.254.")
  ) {
    throw new Error("Prohibited AI provider baseUrl: cloud metadata endpoint.");
  }

  const isLocalDev = process.env.NODE_ENV !== "production" && (hostname === "localhost" || hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDev) {
    throw new Error("AI provider baseUrl must use HTTPS.");
  }

  // Private network IP ranges in production
  if (process.env.NODE_ENV === "production") {
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new Error("Prohibited AI provider baseUrl: private or loopback IP range.");
    }
  }

  return url.origin + url.pathname.replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Formatters for External Providers
// ---------------------------------------------------------------------------

function toOpenAI(messages: AiMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.toolCallId) {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content ?? "" });
      continue;
    }
    if (m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
        })),
      });
      continue;
    }
    out.push({ role: m.role, content: m.content ?? "" });
  }
  return out;
}

function toGemini(messages: AiMessage[], tools: AiToolDef[], systemPrompt: string) {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const parts: Record<string, unknown>[] = [];
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments ?? {} } });
        }
      }
      if (m.toolCallId) {
        parts.push({ functionResponse: { name: "", response: { result: m.content ?? "" } } });
      }
      if (m.content) parts.push({ text: m.content });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

  const toolDefs = tools.length
    ? [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          })),
        },
      ]
    : undefined;

  return { contents, tools: toolDefs, systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined };
}

function toAnthropicMessages(messages: AiMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.toolCallId) {
      out.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content ?? "" }],
      });
      continue;
    }
    if (m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: [
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...m.toolCalls.map((tc) => ({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments ?? {},
          })),
        ],
      });
      continue;
    }
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content ?? "" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Provider Callers
// ---------------------------------------------------------------------------

async function callOpenAICompatible(
  config: AiProviderConfig,
  baseUrl: string,
  messages: AiMessage[],
  tools: AiToolDef[],
  startTime: number,
): Promise<ProviderResult> {
  const safeBase = assertSafeBaseUrl(baseUrl);
  let res: Response;
  try {
    res = await fetch(`${safeBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: toOpenAI(messages),
        tools: tools.length
          ? tools.map((t) => ({
              type: "function",
              function: { name: t.name, description: t.description, parameters: t.inputSchema },
            }))
          : undefined,
        tool_choice: tools.length ? "auto" : undefined,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new AiTimeoutError(`Request timed out after ${config.timeoutMs}ms`, config.provider);
    }
    throw new AiProviderError(err?.message ?? "Network error calling OpenAI-compatible provider", { provider: config.provider });
  }

  if (res.status === 429) {
    throw new AiRateLimitError("Rate limit exceeded for provider", config.provider);
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiAuthenticationError("Invalid API key or authentication error", config.provider);
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new AiProviderError(`Provider returned error (${res.status}): ${text}`, {
      status: res.status,
      provider: config.provider,
      retryable: res.status >= 500,
    });
  }

  const json = await res.json();
  const message = json.choices?.[0]?.message ?? {};
  const toolCalls: AiToolCall[] = (message.tool_calls ?? []).map(
    (tc: { id: string; function?: { name?: string; arguments?: string } }) => ({
      id: tc.id,
      name: tc.function?.name ?? "",
      arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
    }),
  );

  const promptTokens = json.usage?.prompt_tokens ?? 0;
  const completionTokens = json.usage?.completion_tokens ?? 0;
  const totalTokens = json.usage?.total_tokens ?? promptTokens + completionTokens;
  const latencyMs = Date.now() - startTime;

  return {
    content: message.content ?? null,
    toolCalls,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateTokenCost(config.model, promptTokens, completionTokens),
      latencyMs,
    },
    providerUsed: config.provider,
    modelUsed: config.model,
  };
}

async function callGemini(
  config: AiProviderConfig,
  messages: AiMessage[],
  tools: AiToolDef[],
  systemPrompt: string,
  startTime: number,
): Promise<ProviderResult> {
  const base = config.baseUrl ? assertSafeBaseUrl(config.baseUrl) : "https://generativelanguage.googleapis.com/v1beta";
  const { contents, tools: toolDefs, systemInstruction } = toGemini(messages, tools, systemPrompt);

  let res: Response;
  try {
    res = await fetch(`${base}/models/${config.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(toolDefs ? { tools: toolDefs } : {}),
        generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens },
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new AiTimeoutError(`Gemini request timed out after ${config.timeoutMs}ms`, config.provider);
    }
    throw new AiProviderError(err?.message ?? "Network error calling Gemini", { provider: config.provider });
  }

  if (res.status === 429) throw new AiRateLimitError("Rate limit exceeded for Gemini", "gemini");
  if (res.status === 401 || res.status === 403) throw new AiAuthenticationError("Invalid Google API key", "gemini");
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new AiProviderError(`Gemini error (${res.status}): ${text}`, {
      status: res.status,
      provider: "gemini",
      retryable: res.status >= 500,
    });
  }

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("");
  const functionCalls: AiToolCall[] = parts
    .filter((p: { functionCall?: { name?: string; args?: Record<string, unknown> } }) => p.functionCall)
    .map((p: { functionCall: { name: string; args: Record<string, unknown> } }) => ({
      id: `call_${Math.random().toString(36).slice(2, 10)}`,
      name: p.functionCall.name,
      arguments: (p.functionCall.args ?? {}) as Record<string, unknown>,
    }));

  const promptTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens = json.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens;
  const latencyMs = Date.now() - startTime;

  return {
    content: text || null,
    toolCalls: functionCalls,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateTokenCost(config.model, promptTokens, completionTokens),
      latencyMs,
    },
    providerUsed: "gemini",
    modelUsed: config.model,
  };
}

async function callAnthropic(
  config: AiProviderConfig,
  messages: AiMessage[],
  tools: AiToolDef[],
  systemPrompt: string,
  startTime: number,
): Promise<ProviderResult> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: toAnthropicMessages(messages),
        tools: tools.length
          ? tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema,
            }))
          : undefined,
        tool_choice: tools.length ? "auto" : undefined,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new AiTimeoutError(`Anthropic request timed out after ${config.timeoutMs}ms`, config.provider);
    }
    throw new AiProviderError(err?.message ?? "Network error calling Anthropic", { provider: config.provider });
  }

  if (res.status === 429) throw new AiRateLimitError("Rate limit exceeded for Anthropic", "anthropic");
  if (res.status === 401 || res.status === 403) throw new AiAuthenticationError("Invalid Anthropic API key", "anthropic");
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new AiProviderError(`Anthropic error (${res.status}): ${text}`, {
      status: res.status,
      provider: "anthropic",
      retryable: res.status >= 500,
    });
  }

  const json = await res.json();
  const blocks = json.content ?? [];
  const text = blocks
    .filter((b: { type: string; text?: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");

  const toolCalls: AiToolCall[] = [];
  for (const b of blocks) {
    if (b.type === "tool_use") {
      toolCalls.push({
        id: b.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
        name: b.name,
        arguments: (b.input ?? {}) as Record<string, unknown>,
      });
    }
  }

  const promptTokens = json.usage?.input_tokens ?? 0;
  const completionTokens = json.usage?.output_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const latencyMs = Date.now() - startTime;

  return {
    content: text || null,
    toolCalls,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateTokenCost(config.model, promptTokens, completionTokens),
      latencyMs,
    },
    providerUsed: "anthropic",
    modelUsed: config.model,
  };
}

// ---------------------------------------------------------------------------
// Mock Provider for Testing & Deterministic Operation
// ---------------------------------------------------------------------------

async function callMockProvider(
  config: AiProviderConfig,
  messages: AiMessage[],
  tools: AiToolDef[],
  startTime: number,
): Promise<ProviderResult> {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const lastToolResponse = [...messages].reverse().find((m) => m.toolCallId);

  // Simulated failure modes for testing fallback and resilience
  if (lastUserMessage.includes("simulate_rate_limit")) {
    throw new AiRateLimitError("Mock rate limit reached", "mock");
  }
  if (lastUserMessage.includes("simulate_timeout")) {
    throw new AiTimeoutError("Mock timeout exceeded", "mock");
  }
  if (lastUserMessage.includes("simulate_auth_error")) {
    throw new AiAuthenticationError("Mock invalid credentials", "mock");
  }

  // If we already received a tool response, synthesize a final answer
  if (lastToolResponse) {
    return {
      content: `I have processed your request. Result: ${lastToolResponse.content}`,
      toolCalls: [],
      usage: {
        promptTokens: 120,
        completionTokens: 35,
        totalTokens: 155,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - startTime,
      },
      providerUsed: "mock",
      modelUsed: config.model,
    };
  }

  // Detect tool invocations based on message keywords
  const toolCalls: AiToolCall[] = [];

  if (lastUserMessage.includes("cancel_reservation") || lastUserMessage.includes("cancel reservation")) {
    const resIdMatch = lastUserMessage.match(/(?:cancel reservation|cancel_reservation)\s+([a-z0-9_-]+)/i);
    const reservationId = resIdMatch ? resIdMatch[1] : "res-123";
    toolCalls.push({
      id: `call_${Math.random().toString(36).slice(2, 9)}`,
      name: "cancel_reservation",
      arguments: {
        reservationId,
        reason: "Guest request via AI agent",
      },
    });
  } else if (lastUserMessage.includes("refund_payment") || lastUserMessage.includes("refund payment")) {
    const payIdMatch = lastUserMessage.match(/(?:refund payment|refund_payment)\s+(?:for payment\s+)?([a-z0-9_-]+)/i);
    const paymentId = payIdMatch ? payIdMatch[1] : "pay-123";
    toolCalls.push({
      id: `call_${Math.random().toString(36).slice(2, 9)}`,
      name: "refund_payment",
      arguments: {
        paymentId,
        amount: 150.0,
        reason: "Requested refund via operations agent",
      },
    });
  } else if (lastUserMessage.includes("check_availability") || lastUserMessage.includes("availability")) {
    toolCalls.push({
      id: `call_${Math.random().toString(36).slice(2, 9)}`,
      name: "check_availability",
      arguments: {
        propertyId: "prop-123",
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
      },
    });
  } else if (lastUserMessage.includes("search_reservations") || lastUserMessage.includes("search reservations")) {
    toolCalls.push({
      id: `call_${Math.random().toString(36).slice(2, 9)}`,
      name: "search_reservations",
      arguments: {
        query: "Smith",
      },
    });
  } else if (lastUserMessage.includes("update_room_status") || lastUserMessage.includes("clean room")) {
    toolCalls.push({
      id: `call_${Math.random().toString(36).slice(2, 9)}`,
      name: "update_room_status",
      arguments: {
        roomId: "room-101",
        status: "clean",
      },
    });
  } else if (lastUserMessage.includes("bulk_send_messages") || lastUserMessage.includes("broadcast")) {
    toolCalls.push({
      id: `call_${Math.random().toString(36).slice(2, 9)}`,
      name: "bulk_send_messages",
      arguments: {
        propertyId: "prop-123",
        message: "Severe weather alert: check-in kiosk is moved to lobby B.",
        target: "all_active",
      },
    });
  }

  // Filter tools to only those requested that are actually in the available tool definitions
  const validToolCalls = toolCalls.filter((tc) => tools.some((t) => t.name === tc.name));

  return {
    content: validToolCalls.length === 0 ? `I am the Lumina PMS assistant. How can I help with reservations, rooms, or guests?` : null,
    toolCalls: validToolCalls,
    usage: {
      promptTokens: 85,
      completionTokens: validToolCalls.length ? 40 : 25,
      totalTokens: validToolCalls.length ? 125 : 110,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startTime,
    },
    providerUsed: "mock",
    modelUsed: config.model,
  };
}

// ---------------------------------------------------------------------------
// Main Provider Dispatcher
// ---------------------------------------------------------------------------

export async function providerChatCompletion(
  config: AiProviderConfig,
  messages: AiMessage[],
  tools: AiToolDef[],
  systemPrompt = "You are the Lumina PMS operations assistant.",
): Promise<ProviderResult> {
  const startTime = Date.now();

  switch (config.provider) {
    case "openai":
    case "groq": {
      const baseUrl = config.provider === "groq" ? "https://api.groq.com/openai/v1" : config.baseUrl ?? "https://api.openai.com/v1";
      return callOpenAICompatible(config, baseUrl, messages, tools, startTime);
    }
    case "gemini":
      return callGemini(config, messages, tools, systemPrompt, startTime);
    case "anthropic":
      return callAnthropic(config, messages, tools, systemPrompt, startTime);
    case "mock":
      return callMockProvider(config, messages, tools, startTime);
    default:
      throw new AiProviderError(`Unsupported AI provider: ${config.provider}`, { provider: String(config.provider) });
  }
}

// ---------------------------------------------------------------------------
// Provider Models Fetcher
// ---------------------------------------------------------------------------

export async function fetchProviderModels(config: AiProviderConfig): Promise<string[]> {
  if (config.provider === "mock") {
    return ["mock-operations-v1", "mock-fast-v1"];
  }

  if (config.provider === "openai" || config.provider === "groq") {
    const baseUrl = config.provider === "groq" ? "https://api.groq.com/openai/v1" : config.baseUrl ?? "https://api.openai.com/v1";
    const safeBase = assertSafeBaseUrl(baseUrl);
    const res = await fetch(`${safeBase}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) throw new AiProviderError(`Failed to list models (${res.status})`, { provider: config.provider, status: res.status });
    const json = await res.json();
    const models: string[] = (json.data ?? []).map((m: { id: string }) => m.id);
    return models.length ? models : [config.model];
  }

  if (config.provider === "gemini") {
    const base = config.baseUrl ? assertSafeBaseUrl(config.baseUrl) : "https://generativelanguage.googleapis.com/v1beta";
    const res = await fetch(`${base}/models`, {
      headers: { "x-goog-api-key": config.apiKey },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) throw new AiProviderError(`Failed to list models (${res.status})`, { provider: "gemini", status: res.status });
    const json = await res.json();
    const models: string[] = (json.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, ""));
    return models.length ? models : [config.model];
  }

  // Anthropic has no public list endpoint; return configured model
  return [config.model];
}
