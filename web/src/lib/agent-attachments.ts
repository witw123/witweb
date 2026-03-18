import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { AgentAttachment } from "@/features/agent/types";
import {
  AGENT_ATTACHMENT_LIMIT,
  formatAgentAttachmentSize,
  inferAgentAttachmentKind,
  isTextAgentAttachment,
} from "@/lib/agent-attachment-utils";
import { ApiError } from "@/lib/api-error";
import { z } from "@/lib/validate";

const AGENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const AGENT_ATTACHMENT_PREVIEW_LIMIT = 2000;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);
const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export const agentAttachmentSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  url: z.string().trim().min(1),
  size: z.number().int().min(0),
  kind: z.enum(["image", "document"]),
});

export const agentAttachmentsSchema = z.array(agentAttachmentSchema).max(AGENT_ATTACHMENT_LIMIT);

export interface AgentAttachmentReadItem {
  id: string;
  name: string;
  mime_type: string;
  url: string;
  size: number;
  kind: AgentAttachment["kind"];
  access: "full_text" | "metadata_only";
  content_excerpt?: string;
}

function getUploadsDir() {
  return path.resolve(process.cwd(), "..", "uploads");
}

function normalizeMimeType(file: File) {
  const explicit = file.type.trim().toLowerCase();
  if (explicit) return explicit;

  const ext = path.extname(file.name).toLowerCase();
  if (TEXT_ATTACHMENT_EXTENSIONS.has(ext)) {
    return ext === ".txt" ? "text/plain" : "text/markdown";
  }
  if (ext === ".pdf") {
    return "application/pdf";
  }
  return "";
}

function isSupportedAttachment(mimeType: string) {
  if (mimeType.startsWith("image/")) return true;
  if (mimeType === "application/pdf") return true;
  return isTextAgentAttachment(mimeType);
}

function sanitizeAttachmentName(filename: string) {
  const trimmed = path.basename(filename).trim();
  const safeName = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safeName || "attachment";
}

function resolveStoredExtension(filename: string, mimeType: string) {
  const currentExt = path.extname(filename).toLowerCase();
  if (currentExt) return currentExt;
  return MIME_EXTENSIONS[mimeType] || ".bin";
}

function resolveAttachmentDiskPath(url: string) {
  if (!url.startsWith("/uploads/")) return null;
  const filename = path.basename(url);
  if (!filename) return null;
  return path.join(getUploadsDir(), filename);
}

async function readAttachmentExcerpt(attachment: AgentAttachment) {
  if (!isTextAgentAttachment(attachment.mime_type)) return "";

  const filePath = resolveAttachmentDiskPath(attachment.url);
  if (!filePath) return "";

  const raw = await fs.readFile(filePath, "utf8");
  const text = raw.replace(/\u0000/g, "").trim();
  if (!text) return "";

  return text.length > AGENT_ATTACHMENT_PREVIEW_LIMIT
    ? `${text.slice(0, AGENT_ATTACHMENT_PREVIEW_LIMIT)}...`
    : text;
}

export async function readAgentAttachments(
  attachments: AgentAttachment[],
  options?: {
    limit?: number;
  }
): Promise<AgentAttachmentReadItem[]> {
  const limit = Math.max(1, Math.min(12, options?.limit || attachments.length || 1));
  const selected = attachments.slice(0, limit);

  return await Promise.all(
    selected.map(async (attachment) => {
      const excerpt = await readAttachmentExcerpt(attachment).catch(() => "");
      return {
        id: attachment.id,
        name: attachment.name,
        mime_type: attachment.mime_type,
        url: attachment.url,
        size: attachment.size,
        kind: attachment.kind,
        access: excerpt ? "full_text" : "metadata_only",
        ...(excerpt ? { content_excerpt: excerpt } : {}),
      };
    })
  );
}

export async function saveAgentAttachmentFile(file: File): Promise<AgentAttachment> {
  const mimeType = normalizeMimeType(file);
  if (!mimeType || !isSupportedAttachment(mimeType)) {
    throw ApiError.badRequest("仅支持图片、TXT、Markdown、PDF 附件");
  }

  if (file.size > AGENT_ATTACHMENT_MAX_BYTES) {
    throw ApiError.badRequest("单个附件不能超过 10 MB");
  }

  const safeName = sanitizeAttachmentName(file.name);
  const ext = resolveStoredExtension(safeName, mimeType);
  const storageName = `${Date.now()}-${randomUUID().replace(/-/g, "")}${ext}`;
  const targetDir = getUploadsDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, storageName), buffer);

  return {
    id: `att_${randomUUID().replace(/-/g, "")}`,
    name: safeName,
    mime_type: mimeType,
    url: `/uploads/${storageName}`,
    size: file.size,
    kind: inferAgentAttachmentKind(mimeType),
  };
}

export async function buildAgentAttachmentContext(attachments: AgentAttachment[]) {
  if (attachments.length === 0) return "";

  const items = await readAgentAttachments(attachments);
  const lines = items.map((attachment, index) => {
    const header = `${index + 1}. ${attachment.name} (${attachment.mime_type}, ${formatAgentAttachmentSize(attachment.size)})`;
    if (attachment.content_excerpt) {
      return `${header}\nExtracted text:\n${attachment.content_excerpt}`;
    }
    if (attachment.kind === "image") {
      return `${header}\nThis is an uploaded image. Only the file name and file type are available for now.`;
    }
    return `${header}\nFull text extraction is not available for this file type yet.`;
  });

  return `User attachments:\n${lines.join("\n\n")}`;
}
