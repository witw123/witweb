import type { AgentAttachment } from "@/features/agent/types";

const TEXT_ATTACHMENT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown"]);

export const AGENT_ATTACHMENT_LIMIT = 6;
export const AGENT_ATTACHMENT_ACCEPT = "image/*,.txt,.md,.markdown,text/plain,text/markdown,application/pdf";

export function inferAgentAttachmentKind(mimeType: string): AgentAttachment["kind"] {
  return mimeType.toLowerCase().startsWith("image/") ? "image" : "document";
}

export function isTextAgentAttachment(mimeType: string) {
  return TEXT_ATTACHMENT_MIME_TYPES.has(mimeType.toLowerCase());
}

export function formatAgentAttachmentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildAgentAttachmentFallbackMessage(
  attachments: Array<Pick<AgentAttachment, "name">>
) {
  if (attachments.length === 0) return "";
  if (attachments.length === 1) {
    return `请查看我上传的附件：${attachments[0].name}`;
  }
  return `请查看我上传的 ${attachments.length} 个附件：${attachments
    .slice(0, 3)
    .map((item) => item.name)
    .join("、")}${attachments.length > 3 ? " 等" : ""}`;
}
