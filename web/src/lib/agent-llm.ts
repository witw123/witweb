/**
 * AI Agent LLM 集成模块
 *
 * 提供与大型语言模型的交互接口，包括内容生成、雷达分析等功能
 * 支持流式响应、错误分类和结果解析
 */

import "server-only";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { invokeModelText } from "@/lib/model-runtime";

/** Agent 类型：topic-主题研究、writing-写作、publish-发布 */
export type AgentType = "topic" | "writing" | "publish";

/** 支持的 AI 模型列表 */
export const AGENT_MODELS = ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash"] as const;

/** AI 模型类型 */
export type AgentModel = (typeof AGENT_MODELS)[number];

/** AI Agent 生成的内容包 */
export type AgentDraftBundle = {
  /** 关键词数组 */
  keywords: string[];
  /** 标题 */
  title: string;
  /** 标签（逗号分隔） */
  tags: string;
  /** 文章大纲 */
  outline: string[];
  /** 正文内容（Markdown） */
  content: string;
  /** SEO 元数据 */
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  /** 封面图片提示词 */
  coverPrompt: string;
};

/** 雷达分析输入项 */
export type RadarAnalysisInput = {
  /** 文章标题 */
  title: string;
  /** 内容摘要 */
  summary: string;
  /** 来源名称 */
  sourceName: string;
  /** 来源 URL */
  url: string;
  /** 热度分数 */
  score: number;
  /** 发布时间 */
  publishedAt: string;
};

/** 雷达分析结果 */
export type RadarAnalysisResult = {
  /** 总体趋势总结 */
  summary: string;
  /** 关键词列表 */
  keywords: string[];
  /** 可写角度列表 */
  angles: string[];
  /** 风险点列表 */
  risks: string[];
  /** Markdown 格式的分析报告 */
  markdown: string;
};

type ErrorWithCause = {
  message?: unknown;
  cause?: { code?: unknown };
};

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

  const title = bundle.title?.trim() || goal;
  const outline = bundle.outline.length > 0 ? bundle.outline : ["背景", "方法", "步骤", "总结"];
  const rawContent = bundle.content?.trim() || `# ${goal}`;
  const content = normalizeMarkdownContent(rawContent, title, outline);

  return {
    keywords,
    title,
    tags: bundle.tags?.trim() || keywords.join(", "),
    outline,
    content,
    seo: {
      title: bundle.seo?.title?.trim() || title.slice(0, 58),
      description: bundle.seo?.description?.trim() || `${goal}，由 AI 自动生成。`.slice(0, 120),
      keywords: bundle.seo?.keywords?.length ? bundle.seo.keywords : keywords,
    },
    coverPrompt: bundle.coverPrompt?.trim() || `深色科技风封面，主题：${goal}，简洁排版`,
  };
}

function normalizeMarkdownContent(content: string, title: string, outline: string[]) {
  const cleaned = stripThinkBlocks(content)
    .replace(/\r\n/g, "\n")
    .trim();

  if (!cleaned) {
    return `# ${title}\n\n## ${outline[0] || "正文"}\n\n待补充内容。`;
  }

  const hasHeading = /^#\s+/m.test(cleaned);
  const sections = cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const normalizedBlocks = sections.map((block, index) => {
    if (/^#{1,6}\s+/.test(block) || /^[-*]\s+/.test(block) || /^\d+\.\s+/.test(block)) {
      return block;
    }

    if (block.length <= 28 && index < outline.length) {
      return `## ${block}`;
    }

    return block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n\n");
  });

  const body = normalizedBlocks.join("\n\n").trim();
  return hasHeading ? body : `# ${title}\n\n${body}`;
}


async function requestModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    const response = await invokeModelText({
      model,
      capability: "agent_llm",
      systemPrompt,
      userPrompt,
      onChunk,
    });
    const content = stripThinkBlocks(response.output);
    if (!content.trim()) {
      throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型返回为空：请检查上游服务状态");
    }
    return content;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;

    const causeCode = (error as ErrorWithCause)?.cause?.code;
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
      `模型调用失败：${typeof (error as ErrorWithCause)?.message === "string" ? (error as ErrorWithCause).message : "未知网络错误"}`
    );
  }
}

/**
 * 生成 AI Agent 内容草稿
 *
 * 调用 LLM 生成完整的文章内容包，包含标题、标签、大纲、正文和 SEO 信息
 *
 * @param goal - 内容目标/主题
 * @param agentType - Agent 类型
 * @param options.onChunk - 流式回调（可选）
 * @param options.model - 指定模型（可选，默认环境配置）
 * @param options.assistantName - 助手名称（可选）
 * @param options.customSystemPrompt - 自定义系统提示词（可选）
 * @returns 生成的内容包
 * @throws 未配置 API 时抛出错误
 */
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
  const model = (options.model || AGENT_MODELS[0]) as AgentModel;

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

  const content = await requestModel(model, systemPrompt, userPrompt, options.onChunk);
  let parsed = parseModelJson(content);
  if (!parsed) {
    const retryPrompt = `${userPrompt}\n\n再次强调：只返回 JSON 对象本身，不要输出 <think>、解释、额外文本。`;
    const retried = await requestModel(model, systemPrompt, retryPrompt);
    parsed = parseModelJson(retried);
  }
  if (!parsed) {
    throw new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, "模型返回格式错误：未返回合法 JSON", {
      raw_preview: content.slice(0, 500),
    });
  }
  return normalizeBundle(parsed, goal);
}

function parseRadarAnalysis(raw: string): RadarAnalysisResult {
  const cleaned = stripThinkBlocks(raw);
  const jsonText = extractJsonString(cleaned);

  try {
    const parsed = JSON.parse(jsonText) as Partial<RadarAnalysisResult>;
    const summary = String(parsed.summary || "").trim();
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 12) : [];
    const angles = Array.isArray(parsed.angles) ? parsed.angles.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 8) : [];
    const risks = Array.isArray(parsed.risks) ? parsed.risks.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 8) : [];
    const markdown = String(parsed.markdown || "").trim();

    return {
      summary: summary || "暂无总结",
      keywords,
      angles,
      risks,
      markdown: markdown || cleaned,
    };
  } catch {
    return {
      summary: "模型未返回结构化 JSON，已回退为原文输出。",
      keywords: [],
      angles: [],
      risks: [],
      markdown: cleaned,
    };
  }
}

/**
 * 生成热点雷达分析
 *
 * 分析多个热点内容，生成选题建议、关键词、风险点等
 *
 * @param items - 热点内容列表
 * @param options.focus - 分析重点（可选）
 * @param options.model - 指定模型（可选）
 * @returns 分析结果
 * @throws 无内容或未配置 API 时抛出错误
 */
export async function generateRadarAnalysis(
  items: RadarAnalysisInput[],
  options: {
    focus?: string;
    model?: AgentModel;
  } = {}
): Promise<RadarAnalysisResult> {
  const model = (options.model || AGENT_MODELS[0]) as AgentModel;

  if (items.length === 0) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "暂无可分析的热点内容，请先抓取来源");
  }

  const focusText = options.focus?.trim() || "不限";
  const compactItems = items.map((item, index) => ({
    index: index + 1,
    title: item.title,
    summary: item.summary,
    source: item.sourceName,
    url: item.url,
    score: item.score,
    publishedAt: item.publishedAt,
  }));

  const systemPrompt = "你是中文内容策略分析师。必须只输出 JSON，不要输出解释文本。";
  const userPrompt = `请分析以下热点，并生成可执行选题建议。
分析重点：${focusText}

热点列表(JSON)：
${JSON.stringify(compactItems)}

必须返回合法 JSON，格式如下：
{
  "summary": "总体趋势总结（中文）",
  "keywords": ["关键词1", "关键词2"],
  "angles": ["可写角度1", "可写角度2"],
  "risks": ["风险点1", "风险点2"],
  "markdown": "# 选题分析报告\\n..."
}`;

  const content = await requestModel(model, systemPrompt, userPrompt);
  return parseRadarAnalysis(content);
}
