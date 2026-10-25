// Provider-agnostic AI adapter with OpenAI/Gemini/Groq/Anthropic implementations
// and normalized tool-calling message history.

export type AiProviderId = "openai" | "gemini" | "groq" | "anthropic";

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
}

export interface ProviderResult {
  content: string | null;
  toolCalls: AiToolCall[];
  usage?: Record<string, unknown>;
}

export interface AiToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

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
        parts.push({ functionResponse: { name: "", args: {}, response: { result: m.content ?? "" } } });
      }
      if (m.content) parts.push({ text: m.content });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });
  const toolDefs = {
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: { type: "object", properties: t.inputSchema, required: Object.keys(t.inputSchema), additionalProperties: false },
    })),
  };
  return { contents, tools: toolDefs, systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined };
}

export function assertSafeBaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && (process.env.NODE_ENV === "production" || (url.hostname !== "localhost" && url.hostname !== "127.0.0.1"))) {
    throw new Error("AI provider baseUrl must use HTTPS.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "169.254.169.254" || hostname.includes("metadata.google.internal") || hostname.startsWith("169.254.")) {
    throw new Error("Prohibited AI provider baseUrl: cloud metadata endpoint.");
  }
  if (process.env.NODE_ENV === "production") {
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new Error("Prohibited AI provider baseUrl: private or loopback IP range.");
    }
  }
  return url.origin + url.pathname.replace(/\/$/, "");
}

async function callOpenAICompatible(config: AiProviderConfig, baseUrl: string, messages: AiMessage[], tools: AiToolDef[]) {
  const safeBase = assertSafeBaseUrl(baseUrl);
  const res = await fetch(`${safeBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: toOpenAI(messages),
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      })),
      tool_choice: "auto",
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) throw new Error(`AI provider error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const message = json.choices?.[0]?.message ?? {};
  const toolCalls: AiToolCall[] = (message.tool_calls ?? []).map((tc: { id: string; function?: { name?: string; arguments?: string } }) => ({
    id: tc.id,
    name: tc.function?.name ?? "",
    arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
  }));
  return { content: message.content ?? null, toolCalls, usage: json.usage };
}

async function callGemini(config: AiProviderConfig, messages: AiMessage[], tools: AiToolDef[], systemPrompt: string) {
  const base = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const { contents, tools: toolDefs, systemInstruction } = toGemini(messages, tools, systemPrompt);
  const res = await fetch(`${base}/models/${config.model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      tools: toolDefs,
      generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens },
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) throw new Error(`AI provider error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("");
  const functionCalls = parts
    .filter((p: { functionCall?: { name?: string; args?: Record<string, unknown> } }) => p.functionCall)
    .map((p: { functionCall: { name: string; args: Record<string, unknown> } }) => ({
      id: `call_${Math.random().toString(36).slice(2, 10)}`,
      name: p.functionCall.name,
      arguments: (p.functionCall.args ?? {}) as Record<string, unknown>,
    }));
  return { content: text || null, toolCalls: functionCalls, usage: json.usage };
}

async function callAnthropic(config: AiProviderConfig, messages: AiMessage[], tools: AiToolDef[], systemPrompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: { type: "object", properties: t.inputSchema, required: Object.keys(t.inputSchema), additionalProperties: false },
      })),
      tool_choice: tools.length ? "auto" : undefined,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) throw new Error(`AI provider error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const blocks = json.content ?? [];
  const text = blocks.filter((b: { type: string; text?: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
  const toolCalls: AiToolCall[] = [];
  for (const b of blocks) {
    if (b.type === "tool_use") {
      toolCalls.push({ id: b.id ?? `call_${Math.random().toString(36).slice(2, 10)}`, name: b.name, arguments: (b.input ?? {}) as Record<string, unknown> });
    }
  }
  return { content: text || null, toolCalls, usage: json.usage };
}

function toAnthropicMessages(messages: AiMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.toolCallId) {
      out.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content ?? "" }] });
      continue;
    }
    if (m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: [
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...m.toolCalls.map((tc) => ({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments ?? {} })),
        ],
      });
      continue;
    }
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content ?? "" });
  }
  return out;
}

export async function providerChatCompletion(
  config: AiProviderConfig,
  messages: AiMessage[],
  tools: AiToolDef[],
  systemPrompt = "You are the Lumina PMS operations assistant.",
): Promise<ProviderResult> {
  switch (config.provider) {
    case "openai":
    case "groq": {
      const baseUrl = config.provider === "groq" ? "https://api.groq.com/openai/v1" : config.baseUrl ?? "https://api.openai.com/v1";
      return callOpenAICompatible(config, baseUrl, messages, tools);
    }
    case "gemini":
      return callGemini(config, messages, tools, systemPrompt);
    case "anthropic":
      return callAnthropic(config, messages, tools, systemPrompt);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

export async function fetchProviderModels(config: AiProviderConfig): Promise<string[]> {
  if (config.provider === "openai" || config.provider === "groq") {
    const baseUrl = config.provider === "groq" ? "https://api.groq.com/openai/v1" : config.baseUrl ?? "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) throw new Error(`Failed to list models (${res.status})`);
    const json = await res.json();
    const models: string[] = (json.data ?? []).map((m: { id: string }) => m.id);
    return models.length ? models : [config.model];
  }
  if (config.provider === "gemini") {
    const base = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    const res = await fetch(`${base}/models`, { headers: { "x-goog-api-key": config.apiKey }, signal: AbortSignal.timeout(config.timeoutMs) });
    if (!res.ok) throw new Error(`Failed to list models (${res.status})`);
    const json = await res.json();
    const models: string[] = (json.models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, ""));
    return models.length ? models : [config.model];
  }
  // Anthropic: no public list endpoint; return configured model.
  return [config.model];
}
