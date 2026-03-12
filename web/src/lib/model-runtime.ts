import "server-only";

import { ApiError, ErrorCode } from "@/lib/api-error";
import { resolveApiConfig, type ApiCapability } from "@/lib/api-registry";
import {
  getModelApiKey,
  getModelBaseUrl,
  getModelDescriptor,
  type ModelProvider,
} from "@/lib/ai-models";

type ChunkShape = {
  choices?: Array<{
    delta?: { content?: unknown };
    message?: { content?: unknown };
  }>;
  output_text?: unknown;
  data?: { content?: unknown };
  content?: unknown;
};

type ErrorWithCause = {
  message?: unknown;
  cause?: { code?: unknown };
};

type RuntimeModelDescriptor = {
  id: string;
  provider: string;
  label: string;
  endpoint: string;
  configured: boolean;
  timeoutMs: number;
  source: "binding" | "env";
  protocolType: string;
  authScheme: string;
  apiVersion?: string;
  apiKey?: string;
  token?: string;
  extraHeaders?: Record<string, string>;
};

function resolveChatCompletionsUrl(rawEndpoint: string): string {
  const input = rawEndpoint.trim();
  if (!input) return "";

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(ErrorCode.BAD_REQUEST, "模型 endpoint 格式不正确");
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") {
    url.pathname = "/chat/completions";
    return url.toString();
  }
  if (path.endsWith("/chat/completions")) {
    return url.toString();
  }
  if (path === "/v1" || path === "/openai") {
    url.pathname = `${path}/chat/completions`;
    return url.toString();
  }
  url.pathname = `${path}/chat/completions`;
  return url.toString();
}

function resolveEmbeddingsUrl(rawEndpoint: string): string {
  const completionsUrl = resolveChatCompletionsUrl(rawEndpoint);
  const url = new URL(completionsUrl);
  url.pathname = url.pathname.replace(/\/chat\/completions$/, "/embeddings");
  return url.toString();
}

function normalizeEndpoint(_provider: ModelProvider, baseUrl: string): string {
  return resolveChatCompletionsUrl(baseUrl);
}

function normalizeRuntimeEndpoint(protocolType: string, baseUrl: string): string {
  if (protocolType === "anthropic") {
    const input = baseUrl.trim();
    if (!input) return "";
    const url = new URL(input);
    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = path.endsWith("/messages") ? path : `${path || "/v1"}/messages`;
    return url.toString();
  }
  return resolveChatCompletionsUrl(baseUrl);
}

function stripThinkBlocks(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

function collectContentValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
      const content = (part as { content?: unknown }).content;
      if (typeof content === "string") return content;
      return "";
    })
    .join("");
}

function pullContentFromChunk(chunk: unknown): string {
  const typedChunk = chunk as ChunkShape;
  const content = collectContentValue(typedChunk.content);
  if (content) return content;
  const delta = collectContentValue(typedChunk?.choices?.[0]?.delta?.content);
  if (delta) return delta;
  const message = collectContentValue(typedChunk?.choices?.[0]?.message?.content);
  if (message) return message;
  const outputText = collectContentValue(typedChunk?.output_text);
  if (outputText) return outputText;
  const dataContent = collectContentValue(typedChunk?.data?.content);
  if (dataContent) return dataContent;
  return "";
}

function toErrorText(payload: unknown): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
  ) {
    return (payload as { error: { message: string } }).error.message;
  }
  if (typeof (payload as { message?: unknown }).message === "string") {
    return (payload as { message: string }).message;
  }
  return "";
}

function classifyProviderError(status: number, bodyText: string): ApiError {
  if (status === 401 || status === 403) {
    return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型鉴权失败", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }
  if (status === 429) {
    return new ApiError(ErrorCode.RATE_LIMITED, "模型请求过于频繁", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }
  if (status >= 500) {
    return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型上游服务不可用", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }
  return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型调用失败", {
    provider_status: status,
    provider_body: bodyText.slice(0, 300),
  });
}

async function readModelResponse(res: Response, onChunk?: (chunk: string) => void): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (isJson) {
    const payload = await res.json().catch(() => ({}));
    const full = pullContentFromChunk(payload);
    if (full && onChunk) onChunk(full);
    return full;
  }

  if (!res.body) return await res.text();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let aggregated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("event:")) continue;
      const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const piece = pullContentFromChunk(parsed);
        if (piece) {
          aggregated += piece;
          if (onChunk) onChunk(piece);
        }
      } catch {
        // ignore stream parse noise
      }
    }
  }

  if (buffer.trim()) {
    const payload = buffer.trim().startsWith("data:") ? buffer.trim().slice(5).trim() : buffer.trim();
    if (payload && payload !== "[DONE]") {
      try {
        const parsed = JSON.parse(payload);
        const piece = pullContentFromChunk(parsed);
        if (piece) {
          aggregated += piece;
          if (onChunk) onChunk(piece);
        }
      } catch {
        // ignore trailing parse noise
      }
    }
  }

  return aggregated;
}

function buildRuntimeHeaders(runtime: RuntimeModelDescriptor) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (runtime.protocolType === "anthropic") {
    if (runtime.apiKey) headers["x-api-key"] = runtime.apiKey;
    headers["anthropic-version"] = runtime.apiVersion || "2023-06-01";
  } else if (runtime.authScheme === "bearer" && runtime.apiKey) {
    headers.Authorization = `Bearer ${runtime.apiKey}`;
  } else if (runtime.authScheme === "token" && runtime.token) {
    headers.Authorization = `Bearer ${runtime.token}`;
  }

  Object.assign(headers, runtime.extraHeaders || {});
  return headers;
}

async function resolveRuntimeModel(
  requestedModel?: string,
  capability: ApiCapability = "agent_llm"
): Promise<RuntimeModelDescriptor> {
  const managed = await resolveApiConfig(capability);
  if (managed) {
    return {
      id: managed.model || requestedModel || `${managed.provider_code}-managed`,
      provider: managed.provider_code,
      label: managed.connection_name || `Managed ${managed.provider_code}`,
      endpoint: normalizeRuntimeEndpoint(managed.protocol_type, managed.base_url),
      configured: true,
      timeoutMs: 30_000,
      source: managed.source,
      protocolType: managed.protocol_type,
      authScheme: managed.auth_scheme,
      apiVersion: managed.api_version,
      apiKey: managed.api_key,
      token: managed.token,
      extraHeaders: managed.extra_headers,
    };
  }

  const descriptor = getModelDescriptor(requestedModel);
  const apiKey = getModelApiKey(descriptor.provider);
  const baseUrl = getModelBaseUrl(descriptor.provider);

  return {
    id: descriptor.id,
    provider: descriptor.provider,
    label: descriptor.label,
    endpoint: normalizeEndpoint(descriptor.provider, baseUrl),
    configured: descriptor.configured && Boolean(apiKey && baseUrl),
    timeoutMs: descriptor.timeoutMs,
    source: "env",
    protocolType: "openai_compatible",
    authScheme: "bearer",
    apiKey,
  };
}

export async function invokeModelText(input: {
  model?: string;
  capability?: ApiCapability;
  systemPrompt: string;
  userPrompt: string;
  onChunk?: (chunk: string) => void;
  timeoutMs?: number;
}) {
  const runtime = await resolveRuntimeModel(input.model, input.capability || "agent_llm");

  if (!runtime.configured || !runtime.endpoint) {
    throw new ApiError(ErrorCode.BAD_REQUEST, `模型未配置：${runtime.id}`);
  }

  const requestBody =
    runtime.protocolType === "anthropic"
      ? {
          model: runtime.id,
          max_tokens: 512,
          messages: [{ role: "user", content: input.userPrompt }],
          system: input.systemPrompt,
        }
      : {
          model: runtime.id,
          stream: true,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
        };

  const res = await fetch(runtime.endpoint, {
    method: "POST",
    headers: buildRuntimeHeaders(runtime),
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(input.timeoutMs || runtime.timeoutMs),
  }).catch((error: unknown) => {
    const causeCode = (error as ErrorWithCause)?.cause?.code;
    if (causeCode === "UND_ERR_CONNECT_TIMEOUT" || causeCode === "ETIMEDOUT") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型连接超时");
    }
    if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型域名解析失败");
    }
    throw error;
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let providerMessage = "";
    try {
      providerMessage = toErrorText(bodyText ? JSON.parse(bodyText) : null);
    } catch {
      providerMessage = "";
    }
    throw classifyProviderError(res.status, providerMessage || bodyText);
  }

  const content = stripThinkBlocks(await readModelResponse(res, input.onChunk));
  if (!content.trim()) {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型返回为空");
  }

  return {
    model: {
      id: runtime.id,
      provider: runtime.provider,
      label: runtime.label,
      endpoint: runtime.endpoint,
      configured: runtime.configured,
      timeoutMs: runtime.timeoutMs,
      source: runtime.source,
    },
    output: content,
  };
}

export async function invokeModelJson<T>(
  input: {
    model?: string;
    capability?: ApiCapability;
    systemPrompt: string;
    userPrompt: string;
    fallbackPromptSuffix?: string;
  },
  validator: (value: unknown) => T
) {
  const first = await invokeModelText(input);
  const firstJson = extractJsonString(first.output);

  try {
    return {
      ...first,
      parsed: validator(JSON.parse(firstJson)),
      raw_json: firstJson,
    };
  } catch {
    const retried = await invokeModelText({
      ...input,
      userPrompt: `${input.userPrompt}\n\n${input.fallbackPromptSuffix || "再次强调：只返回 JSON 对象本身，不要解释文本。"}`,
    });
    const retryJson = extractJsonString(retried.output);
    return {
      ...retried,
      parsed: validator(JSON.parse(retryJson)),
      raw_json: retryJson,
    };
  }
}

function pickEmbeddingModelId(runtime: RuntimeModelDescriptor) {
  switch (runtime.provider) {
    case "openai":
      return "text-embedding-3-small";
    case "dashscope":
      return "text-embedding-v4";
    case "gemini":
      return "text-embedding-004";
    default:
      return runtime.id;
  }
}

export async function invokeModelEmbedding(input: {
  model?: string;
  capability?: ApiCapability;
  input: string;
  timeoutMs?: number;
}) {
  const runtime = await resolveRuntimeModel(input.model, input.capability || "embedding");

  if (!runtime.configured || !runtime.endpoint) {
    throw new ApiError(ErrorCode.BAD_REQUEST, `模型未配置：${runtime.id}`);
  }

  if (runtime.protocolType === "anthropic") {
    throw new ApiError(ErrorCode.BAD_REQUEST, "当前模型协议不支持 embedding");
  }

  const endpoint = resolveEmbeddingsUrl(runtime.endpoint);
  const requestBody = {
    model: input.model || pickEmbeddingModelId(runtime),
    input: input.input,
    encoding_format: "float",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: buildRuntimeHeaders(runtime),
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(input.timeoutMs || runtime.timeoutMs),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let providerMessage = "";
    try {
      providerMessage = toErrorText(bodyText ? JSON.parse(bodyText) : null);
    } catch {
      providerMessage = "";
    }
    throw classifyProviderError(res.status, providerMessage || bodyText);
  }

  const payload = (await res.json().catch(() => ({}))) as {
    data?: Array<{ embedding?: unknown }>;
  };
  const embedding = payload.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.some((item) => typeof item !== "number")) {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "embedding 响应格式不正确");
  }

  return {
    model: {
      id: requestBody.model,
      provider: runtime.provider,
      label: runtime.label,
      endpoint,
      configured: runtime.configured,
      timeoutMs: runtime.timeoutMs,
      source: runtime.source,
    },
    embedding: embedding as number[],
  };
}
