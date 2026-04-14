"use client";

import { useCallback, useState } from "react";
import type { AgentAttachment } from "@/features/agent/types";
import { uploadAgentAttachmentRequest } from "@/lib/agent-attachment-client";
import {
  AGENT_ATTACHMENT_LIMIT,
  inferAgentAttachmentKind,
} from "@/lib/agent-attachment-utils";
import { getErrorMessage } from "@/lib/api-client";

export interface PendingAttachment extends AgentAttachment {
  local_status: "uploading" | "uploaded" | "failed";
  error?: string;
}

export interface UseAttachmentUploadOptions {
  maxAttachments?: number;
  onError?: (error: string) => void;
}

export function useAttachmentUpload(options: UseAttachmentUploadOptions = {}) {
  const { maxAttachments = AGENT_ATTACHMENT_LIMIT, onError } = options;
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const uploadedAttachments = attachments
    .filter((item) => item.local_status === "uploaded")
    .map<AgentAttachment>(({ local_status: _localStatus, error: _error, ...attachment }) => attachment);

  const isUploading = attachments.some((item) => item.local_status === "uploading");
  const hasFailed = attachments.some((item) => item.local_status === "failed");
  const canAddMore = attachments.length < maxAttachments;

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      const incoming = Array.from(files);
      const availableSlots = maxAttachments - attachments.length;
      if (availableSlots <= 0) {
        onError?.(`最多只能上传 ${maxAttachments} 个附件。`);
        return;
      }

      const selected = incoming.slice(0, availableSlots);
      if (selected.length < incoming.length) {
        onError?.(`最多只能上传 ${maxAttachments} 个附件。`);
      }

      const pendingItems = selected.map<PendingAttachment>((file) => ({
        id: `local-att-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        url: "",
        size: file.size,
        kind: inferAgentAttachmentKind(file.type || ""),
        local_status: "uploading",
      }));

      setAttachments((current) => [...current, ...pendingItems]);

      await Promise.all(
        selected.map(async (file, index) => {
          const pendingId = pendingItems[index].id;
          try {
            const uploaded = await uploadAgentAttachmentRequest(file);
            setAttachments((current) =>
              current.map((item) =>
                item.id === pendingId
                  ? {
                      ...uploaded,
                      local_status: "uploaded",
                    }
                  : item
              )
            );
          } catch (error) {
            setAttachments((current) =>
              current.map((item) =>
                item.id === pendingId
                  ? {
                      ...item,
                      local_status: "failed",
                      error: getErrorMessage(error),
                    }
                  : item
              )
            );
            onError?.(getErrorMessage(error));
          }
        })
      );
    },
    [attachments.length, maxAttachments, onError]
  );

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const setExternalAttachments = useCallback((value: AgentAttachment[]) => {
    setAttachments(
      value.map((att) => ({
        ...att,
        local_status: "uploaded" as const,
      }))
    );
  }, []);

  return {
    attachments,
    uploadedAttachments,
    isUploading,
    hasFailed,
    canAddMore,
    uploadFiles,
    removeAttachment,
    clearAttachments,
    setExternalAttachments,
  };
}
