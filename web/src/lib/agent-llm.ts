import "server-only";
import { ApiError, ErrorCode } from "@/lib/api-error";

export type AgentType = "topic" | "writing" | "publish";
export const AGENT_MODELS = ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash"] as const;
export type AgentModel = (typeof AGENT_MODELS)[number];

export type AgentDraftBundle = {
  keywords: string[];
  title: string;
  tags: string;
  outline: string[];
  content: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  coverPrompt: string;
};

function resolveChatCompletionsUrl(rawEndpoint: string): string {
  const input = rawEndpoint.trim();
  if (!input) return "";

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(ErrorCode.BAD_REQUEST, "AGENT_LLM_ENDPOINT 格式不正确");
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }

  if (path.endsWith("/v1/chat/completions")) {
    return url.toString();
  }

  if (path === "/v1") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }

  url.pathname = `${path}/v1/chat/completions`;
  return url.toString();
}

function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("```")) {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function stripThinkBlocks(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function collectContentValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") return text;
        const content = (part as { content?: unknown }).content;
        if (typeof content === "string") return content;
      }
      return "";
    })
    .join("");
}

function pullContentFromChunk(chunk: any): string {
  const delta = collectContentValue(chunk?.choices?.[0]?.delta?.content);
  if (delta) return delta;

  const message = collectContentValue(chunk?.choices?.[0]?.message?.content);
  if (message) return message;

  const outputText = collectContentValue(chunk?.output_text);
  if (outputText) return outputText;

  const dataContent = collectContentValue(chunk?.data?.content);
  if (dataContent) return dataContent;

  return "";
}

function parseModelJson(raw: string): AgentDraftBundle | null {
  const cleaned = stripThinkBlocks(raw);
  const jsonText = extractJsonString(cleaned);
  try {
    const obj = JSON.parse(jsonText) as Partial<AgentDraftBundle>;
    if (!obj || typeof obj !== "object") return null;
    if (!obj.title || !obj.content) return null;

    return {
      keywords: Array.isArray(obj.keywords) ? obj.keywords.map(String).slice(0, 8) : [],
      title: String(obj.title),
      tags: String(obj.tags || ""),
      outline: Array.isArray(obj.outline) ? obj.outline.map(String).slice(0, 12) : [],
      content: String(obj.content),
      seo: {
        title: String(obj.seo?.title || ""),
        description: String(obj.seo?.description || ""),
        keywords: Array.isArray(obj.seo?.keywords) ? obj.seo.keywords.map(String).slice(0, 10) : [],
      },
      coverPrompt: String(obj.coverPrompt || ""),
    };
  } catch {
    return null;
  }
}

function normalizeBundle(bundle: AgentDraftBundle, goal: string): AgentDraftBundle {
  const keywords =
    bundle.keywords.length > 0
      ? [...new Set(bundle.keywords.map((item) => item.trim()).filter(Boolean))].slice(0, 8)
      : [goal.slice(0, 20)];

  return {
    keywords,
    title: bundle.title?.trim() || goal,
    tags: bundle.tags?.trim() || keywords.join(", "),
    outline: bundle.outline.length > 0 ? bundle.outline : ["背景", "方法", "步骤", "总结"],
    content: bundle.content?.trim() || `# ${goal}`,
    seo: {
      title: bundle.seo?.title?.trim() || (bundle.title?.trim() || goal).slice(0, 58),
      description: bundle.seo?.description?.trim() || `${goal}，由 AI 自动生成。`.slice(0, 120),
      keywords: bundle.seo?.keywords?.length ? bundle.seo.keywords : keywords,
    },
    coverPrompt: bundle.coverPrompt?.trim() || `深色科技风封面，主题：${goal}，简洁排版`,
  };
}

function toErrorText(payload: any): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload?.error?.message === "string") return payload.error.message;
  if (typeof payload?.message === "string") return payload.message;
  return "";
}

function classifyProviderError(status: number, bodyText: string): ApiError {
  const lower = bodyText.toLowerCase();

  if (status === 401 || status === 403) {
    return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型鉴权失败：请检查 API Key 是否正确", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }

  if (
    lower.includes("model") &&
    (lower.includes("not found") || lower.includes("does not exist") || lower.includes("invalid"))
  ) {
    return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型不存在或不可用：请确认 AGENT_LLM_MODEL", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }

  if (status === 429) {
    return new ApiError(ErrorCode.RATE_LIMITED, "模型服务限流：请求过于频繁，请稍后重试", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }

  if (status >= 500) {
    return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型服务异常：上游服务不可用", {
      provider_status: status,
      provider_body: bodyText.slice(0, 300),
    });
  }

  return new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型请求失败：请检查接口配置和参数", {
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

  if (!res.body) {
    return await res.text();
  }

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
        // ignore chunk parse errors
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
        // ignore trailing chunk parse errors
      }
    }
  }

  return aggregated;
}

async function requestModel(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
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

    const content = stripThinkBlocks(await readModelResponse(res, onChunk));
    if (!content.trim()) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型返回为空：请检查上游服务状态");
    }
    return content;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;

    const causeCode = error?.cause?.code || "";
    if (causeCode === "UND_ERR_CONNECT_TIMEOUT" || causeCode === "ETIMEDOUT") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型连接超时：无法连接到上游接口");
    }
    if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型域名解析失败：请检查 AGENT_LLM_ENDPOINT");
    }
    if (causeCode === "ECONNREFUSED") {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型连接被拒绝：请检查网关地址和端口");
    }

    throw new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `模型调用失败：${error?.message || "未知网络错误"}`
    );
  }
}

export async function generateAgentDraft(
  goal: string,
  agentType: AgentType,
  options: {
    onChunk?: (chunk: string) => void;
    model?: AgentModel;
    assistantName?: string;
    customSystemPrompt?: string;
  } = {}
): Promise<AgentDraftBundle> {
  const endpoint = process.env.AGENT_LLM_ENDPOINT?.trim();
  const apiKey = process.env.AGENT_LLM_API_KEY?.trim();
  const envModel = process.env.AGENT_LLM_MODEL?.trim() || "gemini-3-pro";
  const model = (options.model || envModel) as AgentModel;

  if (!endpoint) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "未配置 AGENT_LLM_ENDPOINT");
  }
  if (!apiKey) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "未配置 AGENT_LLM_API_KEY");
  }
  if (!AGENT_MODELS.includes(model)) {
    throw new ApiError(
      ErrorCode.BAD_REQUEST,
      `不支持的模型：${model}。仅支持 ${AGENT_MODELS.join(", ")}`
    );
  }

  const chatCompletionsUrl = resolveChatCompletionsUrl(endpoint);

  const assistantLabel = options.assistantName?.trim() || "中文内容创作代理";
  const baseSystemPrompt =
    `你是${assistantLabel}。严格只输出 JSON，不要输出解释文本、不要使用 Markdown 代码块。`;
  const customPrompt = options.customSystemPrompt?.trim();
  const systemPrompt = customPrompt
    ? `${baseSystemPrompt}\n\n以下是必须遵循的自定义系统提示词：\n${customPrompt}`
    : baseSystemPrompt;
  const userPrompt = `请基于目标生成可直接发布的中文内容包。
目标：${goal}
类型：${agentType}

必须返回合法 JSON，字段如下：
{
  "keywords": ["关键词1", "关键词2"],
  "title": "中文标题",
  "tags": "标签1, 标签2",
  "outline": ["一级段落1", "一级段落2"],
  "content": "完整中文正文（Markdown）",
  "seo": {
    "title": "SEO 标题",
    "description": "SEO 描述",
    "keywords": ["关键词1", "关键词2"]
  },
  "coverPrompt": "中文封面提示词"
}`;

  const content = await requestModel(
    chatCompletionsUrl,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    options.onChunk
  );
  let parsed = parseModelJson(content);
  if (!parsed) {
    const retryPrompt = `${userPrompt}\n\n再次强调：只返回 JSON 对象本身，不要输出 <think>、解释、额外文本。`;
    const retried = await requestModel(
      chatCompletionsUrl,
      apiKey,
      model,
      systemPrompt,
      retryPrompt
    );
    parsed = parseModelJson(retried);
  }
  if (!parsed) {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型返回格式错误：未返回合法 JSON", {
      raw_preview: content.slice(0, 500),
    });
  }
  return normalizeBundle(parsed, goal);
}
