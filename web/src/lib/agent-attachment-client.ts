import type { AgentAttachment } from "@/features/agent/types";
import type { SuccessResponse } from "@/lib/api-response";
import { getVersionedApiPath } from "@/lib/api-version";
import { logError } from "@/lib/logger";

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

export async function uploadAgentAttachmentRequest(file: File): Promise<AgentAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(getVersionedApiPath("/agent/attachments"), {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  const data = readSuccessData<AgentAttachment>(payload);

  if (!response.ok || !data) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message || "附件上传失败。";

    logError({
      source: "agent.attachment.upload",
      error: message,
      context: {
        status: response.status,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    });

    throw new Error(message);
  }

  return data;
}
