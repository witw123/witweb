// Agent display name mappings and formatters

import type { AgentTokenCount } from "@/features/agent/types";

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  "profile.read": "读取创作者资料",
  "blog.list_posts": "查询历史文章",
  "blog.create_post": "保存博客草稿",
  "radar.fetch_and_analyze": "分析近期热点",
  "knowledge.search": "检索知识库",
  "web.search": "搜索公开网页",
  "file.read": "读取附件内容",
  "messages.create_draft": "生成私信草稿",
  "messages.send": "发送站内消息",
  "integrations.n8n_dispatch": "触发外部分发",
  "video.generate": "生成视频提示词",
};

export function getToolDisplayName(toolName?: string): string {
  if (!toolName) return "";
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}

export function getDisplayStepTitle(step: { step_key: string; title: string; tool_name?: string }): string {
  if (step.step_key === "create_video" || step.tool_name === "video.generate") {
    return "生成视频提示词";
  }
  return step.title;
}

export function getStepDecisionLabel(step: { kind: string; tool_name?: string }): string {
  if (step.kind === "tool") return `已选择工具: ${getToolDisplayName(step.tool_name)}`;
  if (step.kind === "llm") return "已选择模型生成内容";
  return "已选择分析步骤";
}

export function getDisplayApprovalAction(approval: { action: string; step_key: string }): string {
  if (approval.step_key === "create_video" || approval.action === "video.generate") {
    return "生成视频提示词";
  }
  if (approval.action === "blog.create_post") return "保存博客草稿";
  return approval.action;
}

export function statusLabel(status?: string): string {
  if (status === "running") return "进行中";
  if (status === "done") return "已完成";
  if (status === "failed") return "失败";
  if (status === "pending") return "等待中";
  if (status === "waiting_approval") return "待审批";
  if (status === "skipped_waiting_approval") return "等待恢复";
  if (status === "started") return "已启动";
  return status || "--";
}

// Token count formatting
export function formatTokenCount(tokens?: AgentTokenCount): string {
  if (!tokens) return "--";
  return `${tokens.total_tokens.toLocaleString()} tokens`;
}

export function formatTokenBreakdown(tokens?: AgentTokenCount): { input: string; output: string; total: string } {
  if (!tokens) {
    return { input: "--", output: "--", total: "--" };
  }
  return {
    input: tokens.input_tokens.toLocaleString(),
    output: tokens.output_tokens.toLocaleString(),
    total: tokens.total_tokens.toLocaleString(),
  };
}

// Retrieval hit formatting
export function formatRetrievalScore(score?: number): string {
  if (score === undefined) return "--";
  return `${(score * 100).toFixed(0)}%`;
}

export function truncateContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

export function getRetrievalSourceIcon(sourceType?: string): string {
  if (!sourceType) return "📄";
  const sourceLower = sourceType.toLowerCase();
  if (sourceLower.includes("blog") || sourceLower.includes("post")) return "📝";
  if (sourceLower.includes("knowledge") || sourceLower.includes("doc")) return "📚";
  if (sourceLower.includes("web") || sourceLower.includes("url")) return "🌐";
  if (sourceLower.includes("file") || sourceLower.includes("upload")) return "📎";
  return "📄";
}
