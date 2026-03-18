import "server-only";

import type { AgentAttachment } from "@/features/agent/types";
import { readAgentAttachments } from "@/lib/agent-attachments";
import { createVideoTask } from "@/lib/studio";
import { syncPostContentLifecycle } from "@/lib/content-sync";
import { publicProfile } from "@/lib/user";
import {
  drizzlePostRepository,
  messageRepository,
  postRepository,
  videoTaskRepository,
} from "@/lib/repositories";
import { generateRadarAnalysis } from "@/lib/agent-llm";
import { dispatchContentEvent } from "@/lib/integrations/n8n";
import { searchKnowledge } from "@/lib/knowledge";
import { searchPublicWeb } from "@/lib/public-web-search";
import { listRadarItems } from "@/lib/topic-radar";

export type ToolRiskLevel = "read" | "write_draft" | "publish_or_send" | "admin";

export interface AgentToolDefinition {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  permissionScope: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

type ToolExecutor = (username: string, input: Record<string, unknown>) => Promise<unknown>;

type RegisteredTool = AgentToolDefinition & {
  execute: ToolExecutor;
};

function coerceString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function coerceNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceAttachments(value: unknown) {
  if (!Array.isArray(value)) return [] as AgentAttachment[];
  return value.filter((item): item is AgentAttachment => {
    return Boolean(
      item &&
        typeof item === "object" &&
        typeof (item as AgentAttachment).id === "string" &&
        typeof (item as AgentAttachment).name === "string" &&
        typeof (item as AgentAttachment).mime_type === "string" &&
        typeof (item as AgentAttachment).url === "string" &&
        typeof (item as AgentAttachment).size === "number" &&
        ((item as AgentAttachment).kind === "image" || (item as AgentAttachment).kind === "document")
    );
  });
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || "post";
  let i = 1;
  while (await drizzlePostRepository.findBySlug(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

const tools: RegisteredTool[] = [
  {
    name: "blog.list_posts",
    description: "按关键词、标签或作者查询文章列表",
    riskLevel: "read",
    permissionScope: "blog:read",
    inputSchema: { q: "string?", tag: "string?", author: "string?", page: "number?", size: "number?" },
    outputSchema: { items: "PostListItem[]", total: "number" },
    execute: async (username, input) =>
      drizzlePostRepository.list({
        page: Math.max(1, coerceNumber(input.page, 1)),
        size: Math.max(1, Math.min(20, coerceNumber(input.size, 5))),
        query: coerceString(input.q),
        tag: coerceString(input.tag),
        author: coerceString(input.author),
        username,
      }),
  },
  {
    name: "blog.create_post",
    description: "创建博客文章，可选择保存为草稿或直接发布",
    riskLevel: "publish_or_send",
    permissionScope: "blog:write",
    inputSchema: {
      title: "string",
      content: "string",
      tags: "string?",
      excerpt: "string?",
      category_id: "number?",
      status: "'draft' | 'published'?",
    },
    outputSchema: { id: "number", slug: "string", status: "string" },
    execute: async (username, input) => {
      const title = coerceString(input.title);
      const content = coerceString(input.content);
      const base = slugify(coerceString(input.slug, title) || title);
      const slug = await ensureUniqueSlug(base);
      const status = coerceString(input.status, "draft") === "published" ? "published" : "draft";
      const id = await postRepository.create({
        title,
        slug,
        content,
        excerpt: coerceString(input.excerpt) || null,
        cover_image_url: coerceString(input.cover_image_url) || null,
        author: username,
        tags: coerceString(input.tags),
        category_id: coerceNumber(input.category_id, 0) || null,
        status,
      });
      await syncPostContentLifecycle(username, {
        id,
        slug,
        title,
        content,
        excerpt: coerceString(input.excerpt) || null,
        cover_image_url: coerceString(input.cover_image_url) || null,
        tags: coerceString(input.tags),
        category_id: coerceNumber(input.category_id, 0) || null,
        status,
      }).catch(() => null);
      return { id, slug, status };
    },
  },
  {
    name: "radar.fetch_and_analyze",
    description: "读取热点源并产出结构化分析摘要",
    riskLevel: "read",
    permissionScope: "radar:read",
    inputSchema: { limit: "number?", q: "string?", focus: "string?" },
    outputSchema: { analysis: "RadarAnalysisResult", item_count: "number" },
    execute: async (username, input) => {
      const items = await listRadarItems(username, {
        limit: Math.max(5, Math.min(50, coerceNumber(input.limit, 10))),
        q: coerceString(input.q) || undefined,
      });
      const analysis = await generateRadarAnalysis(
        items.map((item) => ({
          title: item.title,
          summary: item.summary,
          sourceName: item.source_name,
          url: item.url,
          score: item.score,
          publishedAt: item.published_at,
        })),
        {
          focus: coerceString(input.focus) || undefined,
        }
      );

      return {
        analysis,
        item_count: items.length,
      };
    },
  },
  {
    name: "knowledge.search",
    description: "搜索站内知识库、历史文章和已同步内容，为当前目标补充背景信息、避免重复和提供引用。",
    riskLevel: "read",
    permissionScope: "knowledge:read",
    inputSchema: { query: "string", limit: "number?" },
    outputSchema: {
      items: "KnowledgeSearchItem[]",
      rewritten_query: "string",
      retrieval_confidence: "number",
      filtered_count: "number",
      citations: "Citation[]",
      rag_strategy: "string",
    },
    execute: async (username, input) =>
      searchKnowledge(username, {
        query: coerceString(input.query),
        limit: Math.max(1, Math.min(8, coerceNumber(input.limit, 4))),
      }),
  },
  {
    name: "web.search",
    description: "搜索公开网页结果，补充最新的站外背景信息和参考链接",
    riskLevel: "read",
    permissionScope: "web:read",
    inputSchema: { query: "string", limit: "number?" },
    outputSchema: { query: "string", source: "string", items: "PublicWebSearchItem[]" },
    execute: async (username, input) =>
      searchPublicWeb(username, {
        query: coerceString(input.query),
        limit: Math.max(1, Math.min(8, coerceNumber(input.limit, 5))),
      }),
  },
  {
    name: "file.read",
    description: "读取当前会话中已上传的附件内容或元数据，用于分析文档和附件上下文",
    riskLevel: "read",
    permissionScope: "file:read",
    inputSchema: { attachments: "AgentAttachment[]", limit: "number?" },
    outputSchema: { items: "AgentAttachmentReadItem[]" },
    execute: async (_username, input) => ({
      items: await readAgentAttachments(coerceAttachments(input.attachments), {
        limit: Math.max(1, Math.min(8, coerceNumber(input.limit, 4))),
      }),
    }),
  },
  {
    name: "video.generate",
    description: "发起一个视频生成任务",
    riskLevel: "publish_or_send",
    permissionScope: "video:write",
    inputSchema: { prompt: "string", model: "string?", duration: "number?", aspectRatio: "string?" },
    outputSchema: { task_id: "string", status: "string" },
    execute: async (username, input) => {
      const payload = {
        model: coerceString(input.model, "sora-2"),
        prompt: coerceString(input.prompt),
        url: coerceString(input.url) || undefined,
        aspectRatio: coerceString(input.aspectRatio, "9:16"),
        duration: Math.max(3, coerceNumber(input.duration, 10)),
        remixTargetId: coerceString(input.remixTargetId) || undefined,
        size: coerceString(input.size, "small"),
        webHook: "-1",
        shutProgress: false,
      };
      const taskId = await createVideoTask(payload);
      await videoTaskRepository.create({
        id: taskId,
        username,
        task_type: payload.remixTargetId ? "remix" : payload.url ? "image2video" : "text2video",
        prompt: payload.prompt,
        model: payload.model,
        url: payload.url,
        aspect_ratio: payload.aspectRatio,
        duration: payload.duration,
        remix_target_id: payload.remixTargetId,
        size: payload.size,
      });
      await videoTaskRepository.updateStatus(taskId, { status: "running", progress: 0 });
      return { task_id: taskId, status: "running" };
    },
  },
  {
    name: "integrations.n8n_dispatch",
    description: "将内容事件发送到 n8n 工作流，用于通知或分发",
    riskLevel: "publish_or_send",
    permissionScope: "integrations:n8n",
    inputSchema: { event_type: "string", payload: "object", goal_id: "string?" },
    outputSchema: { delivery_id: "string", status: "string" },
    execute: async (username, input) =>
      dispatchContentEvent(username, {
        eventType: coerceString(input.event_type, "content.draft.created") as
          | "content.draft.created"
          | "content.post.published"
          | "content.video.ready",
        payload: (input.payload as Record<string, unknown>) || {},
        goalId: coerceString(input.goal_id) || null,
      }),
  },
  {
    name: "profile.read",
    description: "读取当前用户公开资料，用于个性化 Agent 输出",
    riskLevel: "read",
    permissionScope: "profile:read",
    inputSchema: {},
    outputSchema: { profile: "UserProfile | null" },
    execute: async (username) => ({ profile: await publicProfile(username, username) }),
  },
  {
    name: "messages.create_draft",
    description: "生成私信草稿，但不直接发送",
    riskLevel: "write_draft",
    permissionScope: "messages:draft",
    inputSchema: { receiver: "string", content: "string" },
    outputSchema: { receiver: "string", content: "string", preview: "string" },
    execute: async (_username, input) => {
      const receiver = coerceString(input.receiver);
      const content = coerceString(input.content);
      return {
        receiver,
        content,
        preview: content.slice(0, 120),
      };
    },
  },
  {
    name: "messages.send",
    description: "向站内用户发送私信",
    riskLevel: "publish_or_send",
    permissionScope: "messages:send",
    inputSchema: { receiver: "string", content: "string" },
    outputSchema: { conversationId: "number", messageId: "number" },
    execute: async (username, input) =>
      messageRepository.sendMessage({
        sender: username,
        receiver: coerceString(input.receiver),
        content: coerceString(input.content),
      }),
  },
];

export function listAgentTools() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    riskLevel: tool.riskLevel,
    permissionScope: tool.permissionScope,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  }));
}

export function getAgentTool(name: string): RegisteredTool | undefined {
  return tools.find((tool) => tool.name === name);
}

export async function executeAgentTool(
  username: string,
  toolName: string,
  input: Record<string, unknown>
) {
  const tool = getAgentTool(toolName);
  if (!tool) {
    throw new Error("tool_not_found");
  }
  return await tool.execute(username, input);
}
