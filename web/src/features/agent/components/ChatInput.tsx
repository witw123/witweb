"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AgentAttachment,
  AgentConversationDto,
  AgentConversationMessage,
  AgentConversationSummary,
  AgentReplyMeta,
} from "@/features/agent/types";
import { AGENT_INPUT_TEXT, createAgentThinkingStages, upsertAgentThinkingStage } from "@/features/agent/constants";
import { uploadAgentAttachmentRequest } from "@/lib/agent-attachment-client";
import {
  AGENT_ATTACHMENT_ACCEPT,
  AGENT_ATTACHMENT_LIMIT,
  buildAgentAttachmentFallbackMessage,
  inferAgentAttachmentKind,
} from "@/lib/agent-attachment-utils";
import { getErrorMessage, isApiClientError, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";

interface ChatInputProps {
  conversationId?: string | null;
  onConversationReady: (id: string) => void;
  goal: string;
  taskType: string;
  onGoalChange: (value: string) => void;
  onTaskTypeChange: (value: string) => void;
  disabled?: boolean;
}

interface OptimisticSnapshot {
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  previousConversation?: AgentConversationDto;
  previousConversations?: AgentConversationSummary[];
}

interface PendingAttachment extends AgentAttachment {
  local_status: "uploading" | "uploaded" | "failed";
  error?: string;
}

type ConversationStreamDonePayload = {
  conversation: AgentConversationDto["conversation"];
  user_message: AgentConversationMessage;
  assistant_message: AgentConversationMessage;
  reply_meta: AgentReplyMeta;
  goals?: AgentConversationDto["goals"];
};

const taskTypeOptions = [
  { value: "hot_topic_article", label: "撰写热点文" },
  { value: "continue_article", label: "续写文章" },
  { value: "article_to_video", label: "图文转视频脚本" },
  { value: "publish_draft", label: "发布草稿" },
] as const;

function buildAttachmentDisplayContent(attachments: AgentAttachment[]) {
  return buildAgentAttachmentFallbackMessage(attachments);
}

export function ChatInput({
  conversationId,
  onConversationReady,
  goal,
  taskType,
  onGoalChange,
  onTaskTypeChange,
  disabled,
}: ChatInputProps) {
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const optimisticSnapshotRef = useRef<OptimisticSnapshot | null>(null);
  const queryClient = useQueryClient();

  const uploadedAttachments = attachments
    .filter((item) => item.local_status === "uploaded")
    .map<AgentAttachment>(({ local_status: _localStatus, error: _error, ...attachment }) => attachment);
  const isUploadingAttachment = attachments.some((item) => item.local_status === "uploading");
  const optimisticDisplayContent = goal.trim() || buildAttachmentDisplayContent(uploadedAttachments);
  const canSubmit = Boolean(optimisticDisplayContent) && !isUploadingAttachment && !disabled;

  const updateOptimisticThinking = (
    nextConversationId: string,
    assistantMessageId: string,
    updater: (meta: AgentReplyMeta | undefined) => AgentReplyMeta
  ) => {
    queryClient.setQueryData<AgentConversationDto>(
      ["agent-conversations", nextConversationId, "detail"],
      (current) => {
        if (!current) return current;
        return {
          ...current,
          messages: current.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  meta: updater(message.meta),
                }
              : message
          ),
        };
      }
    );
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    const incoming = Array.from(files);
    const availableSlots = AGENT_ATTACHMENT_LIMIT - attachments.length;
    if (availableSlots <= 0) {
      setErrorMsg(`最多只能上传 ${AGENT_ATTACHMENT_LIMIT} 个附件。`);
      return;
    }

    const selected = incoming.slice(0, availableSlots);
    setErrorMsg(selected.length < incoming.length ? `最多只能上传 ${AGENT_ATTACHMENT_LIMIT} 个附件。` : "");

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
          setErrorMsg(getErrorMessage(error));
        }
      })
    );
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const userContent = goal.trim();
      const now = new Date().toISOString();
      const optimisticToken = Date.now().toString(36);
      const userMessageContent = userContent || buildAttachmentDisplayContent(uploadedAttachments);
      let activeConversationId = conversationId;
      let baseConversation: AgentConversationSummary | null = null;

      if (!activeConversationId) {
        const created = await post<AgentConversationDto>(getVersionedApiPath("/agent/conversations"), {
          title: userMessageContent.slice(0, 24),
        });
        activeConversationId = created.conversation.id;
        baseConversation = created.conversation;
        queryClient.setQueryData(["agent-conversations", activeConversationId, "detail"], created);
        onConversationReady(activeConversationId);
      }

      const previousConversation = queryClient.getQueryData<AgentConversationDto>([
        "agent-conversations",
        activeConversationId,
        "detail",
      ]);
      const previousConversations = queryClient.getQueryData<AgentConversationSummary[]>(["agent-conversations"]);

      const optimisticUserMessage: AgentConversationMessage = {
        id: `local-user-${optimisticToken}`,
        conversation_id: activeConversationId,
        role: "user",
        content: userMessageContent,
        goal_id: null,
        created_at: now,
        meta: uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : undefined,
      };
      const optimisticAssistantMessage: AgentConversationMessage = {
        id: `local-assistant-${optimisticToken}`,
        conversation_id: activeConversationId,
        role: "assistant",
        content: "",
        goal_id: null,
        created_at: now,
        meta: {
          thinking: {
            current_stage: "intent",
            stages: createAgentThinkingStages(),
          },
        },
        local_status: "streaming",
      };

      queryClient.setQueryData<AgentConversationDto>(
        ["agent-conversations", activeConversationId, "detail"],
        (current) => {
          const currentConversation =
            current?.conversation ||
            baseConversation || {
              id: activeConversationId,
              title: userMessageContent.slice(0, 24),
              last_message_preview: userMessageContent,
              status: "active",
              created_at: now,
              updated_at: now,
            };

          return {
            conversation: {
              ...currentConversation,
              title: currentConversation.title || userMessageContent.slice(0, 24),
              last_message_preview: userMessageContent,
              updated_at: now,
            },
            messages: [...(current?.messages || []), optimisticUserMessage, optimisticAssistantMessage],
            goals: current?.goals || [],
            conversation_memory: current?.conversation_memory || null,
            long_term_memories: current?.long_term_memories || [],
          };
        }
      );

      queryClient.setQueryData<AgentConversationSummary[]>(["agent-conversations"], (current) => {
        const nextSummary: AgentConversationSummary = {
          ...(baseConversation || previousConversation?.conversation || {
            id: activeConversationId,
            title: userMessageContent.slice(0, 24),
            status: "active",
            created_at: now,
            updated_at: now,
            last_message_preview: userMessageContent,
          }),
          title: (baseConversation || previousConversation?.conversation)?.title || userMessageContent.slice(0, 24),
          last_message_preview: userMessageContent,
          updated_at: now,
        };

        const list = current || [];
        const withoutCurrent = list.filter((item) => item.id !== nextSummary.id);
        return [nextSummary, ...withoutCurrent];
      });

      optimisticSnapshotRef.current = {
        conversationId: activeConversationId,
        assistantMessageId: optimisticAssistantMessage.id,
        userMessageId: optimisticUserMessage.id,
        previousConversation,
        previousConversations,
      };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(getVersionedApiPath(`/agent/conversations/${activeConversationId}/messages/stream`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          content: userContent,
          task_type: showAdvanced ? taskType || undefined : undefined,
          attachments: uploadedAttachments,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`conversation_stream_failed:${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: ConversationStreamDonePayload | null = null;

      const applyPhase = (event: { key: string; title: string; status: "pending" | "running" | "done" }) => {
        updateOptimisticThinking(activeConversationId, optimisticAssistantMessage.id, (meta) => {
          const existingStages = meta?.thinking?.stages?.length ? meta.thinking.stages : createAgentThinkingStages();
          const stages = upsertAgentThinkingStage(existingStages, event);
          return {
            ...meta,
            thinking: {
              current_stage: event.status === "done" ? meta?.thinking?.current_stage || event.key : event.key,
              stages,
            },
            execution_stage: event.key === "goal" ? event.status : meta?.execution_stage,
          };
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const payload = JSON.parse(trimmed) as
            | { type: "phase"; key: string; title: string; status: "pending" | "running" | "done" }
            | { type: "delta"; message_id: string; chunk: string }
            | { type: "done"; conversation: ConversationStreamDonePayload }
            | { type: "error"; message: string };

          if (payload.type === "phase") {
            applyPhase(payload);
            continue;
          }

          if (payload.type === "delta") {
            queryClient.setQueryData<AgentConversationDto>(
              ["agent-conversations", activeConversationId, "detail"],
              (current) => {
                if (!current) return current;
                return {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === optimisticAssistantMessage.id
                      ? {
                          ...message,
                          content: `${message.content || ""}${payload.chunk}`,
                          local_status: "streaming",
                        }
                      : message
                  ),
                };
              }
            );
            continue;
          }

          if (payload.type === "done") {
            result = payload.conversation;
            continue;
          }

          if (payload.type === "error") {
            throw new Error(payload.message || "conversation_stream_failed");
          }
        }

        if (done) break;
      }

      if (!result) {
        throw new Error("conversation_stream_missing_result");
      }

      return { conversationId: activeConversationId, data: result };
    },
    onSuccess: ({ conversationId: nextConversationId, data }) => {
      const snapshot = optimisticSnapshotRef.current;
      abortControllerRef.current = null;
      optimisticSnapshotRef.current = null;
      onGoalChange("");
      setAttachments([]);
      setErrorMsg("");
      queryClient.setQueryData<AgentConversationDto>(["agent-conversations", nextConversationId, "detail"], (current) => {
        if (!current) {
          return {
            conversation: data.conversation,
            messages: [data.user_message, data.assistant_message],
            goals: data.goals || [],
            conversation_memory: null,
            long_term_memories: [],
            reply_meta: data.reply_meta,
          };
        }

        return {
          ...current,
          conversation: data.conversation,
          messages: current.messages.map((message) => {
            if (message.id === snapshot?.userMessageId) {
              return data.user_message;
            }
            if (message.id === snapshot?.assistantMessageId) {
              return {
                ...data.assistant_message,
                local_status: "finalized",
              };
            }
            return message;
          }),
          goals: data.goals
            ? [
                ...current.goals.filter((item) => !data.goals!.some((goalItem) => goalItem.goal.id === item.goal.id)),
                ...data.goals,
              ]
            : current.goals,
          reply_meta: data.reply_meta,
        };
      });
      queryClient.setQueryData<AgentConversationSummary[]>(["agent-conversations"], (current) => {
        const base = current || [];
        const nextSummary: AgentConversationSummary = {
          id: data.conversation.id,
          title: data.conversation.title,
          last_message_preview: data.conversation.last_message_preview,
          status: data.conversation.status,
          created_at: data.conversation.created_at,
          updated_at: data.conversation.updated_at,
        };
        return [nextSummary, ...base.filter((item) => item.id !== nextSummary.id)];
      });
      onConversationReady(nextConversationId);
    },
    onError: (err) => {
      const snapshot = optimisticSnapshotRef.current;
      const isAbort = err instanceof Error && err.name === "AbortError";

      abortControllerRef.current = null;
      optimisticSnapshotRef.current = null;

      if (snapshot) {
        if (isAbort) {
          queryClient.setQueryData<AgentConversationDto>(
            ["agent-conversations", snapshot.conversationId, "detail"],
            (current) => {
              if (!current) return current;
              const streamingMessage = current.messages.find((message) => message.id === snapshot.assistantMessageId);
              if (streamingMessage?.content) {
                return {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === snapshot.assistantMessageId
                      ? {
                          ...message,
                          local_status: "stopped",
                        }
                      : message
                  ),
                };
              }
              return {
                ...current,
                messages: current.messages.filter((message) => message.id !== snapshot.assistantMessageId),
              };
            }
          );
        } else {
          queryClient.setQueryData(
            ["agent-conversations", snapshot.conversationId, "detail"],
            snapshot.previousConversation
          );
          queryClient.setQueryData(["agent-conversations"], snapshot.previousConversations);
        }
      }

      if (isAbort) {
        setErrorMsg("");
        return;
      }

      if (isApiClientError(err) && err.details && typeof err.details === "object" && !Array.isArray(err.details)) {
        const fieldErrors = err.details as Record<string, unknown>;
        if (typeof fieldErrors.goal === "string" && fieldErrors.goal.trim()) {
          setErrorMsg(fieldErrors.goal);
          return;
        }
        if (typeof fieldErrors.content === "string" && fieldErrors.content.trim()) {
          setErrorMsg(fieldErrors.content);
          return;
        }
      }

      setErrorMsg(getErrorMessage(err));
    },
  });

  const handleSubmit = () => {
    if (!canSubmit || submitMutation.isPending) return;
    submitMutation.mutate();
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [goal]);

  useEffect(() => {
    if (!goal.trim()) return;
    textareaRef.current?.focus();
    const length = textareaRef.current?.value.length ?? 0;
    textareaRef.current?.setSelectionRange(length, length);
  }, [goal]);

  return (
    <div className="agent-input-container">
      <div className="agent-input-box">
        <input
          ref={fileInputRef}
          type="file"
          accept={AGENT_ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            void handleAttachmentUpload(event.target.files);
            event.currentTarget.value = "";
          }}
        />

        {attachments.length > 0 ? (
          <div className="agent-attachment-list">
            {attachments.map((attachment) => (
              <div key={attachment.id} className={`agent-attachment-chip is-${attachment.local_status}`}>
                <div className="agent-attachment-chip__body">
                  <span className="agent-attachment-chip__name">{attachment.name}</span>
                  <span className="agent-attachment-chip__meta">
                    {attachment.local_status === "uploading"
                      ? "上传中..."
                      : attachment.local_status === "failed"
                        ? attachment.error || "上传失败"
                        : attachment.mime_type}
                  </span>
                </div>
                <button
                  type="button"
                  className="agent-attachment-chip__remove"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  disabled={submitMutation.isPending}
                  aria-label={`移除附件 ${attachment.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          className="agent-textarea custom-scrollbar"
          placeholder={AGENT_INPUT_TEXT.placeholder}
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          disabled={submitMutation.isPending || disabled}
          rows={1}
        />

        {errorMsg ? <div className="mt-1 px-2 text-xs text-red-500">{errorMsg}</div> : null}

        <div className="agent-input-actions">
          <div className="agent-input-actions__left">
            <button
              type="button"
              className="agent-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitMutation.isPending || disabled || attachments.length >= AGENT_ATTACHMENT_LIMIT}
            >
              添加附件
            </button>

            <button
              type="button"
              className={`agent-advanced-toggle ${showAdvanced ? "active" : ""}`}
              onClick={() => setShowAdvanced((value) => !value)}
              disabled={submitMutation.isPending || disabled}
            >
              {showAdvanced ? AGENT_INPUT_TEXT.advancedOpen : AGENT_INPUT_TEXT.advancedClosed}
            </button>
          </div>

          <button
            className={`agent-send-btn ${submitMutation.isPending ? "is-stop" : ""}`}
            onClick={submitMutation.isPending ? handleStop : handleSubmit}
            disabled={submitMutation.isPending ? false : !canSubmit}
            title={submitMutation.isPending ? AGENT_INPUT_TEXT.stopTitle : AGENT_INPUT_TEXT.sendTitle}
            type="button"
          >
            {submitMutation.isPending ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-5-5l5 5-5 5" />
              </svg>
            )}
          </button>
        </div>

        {showAdvanced ? (
          <div className="agent-advanced-panel">
            <label className="agent-advanced-field">
              <span className="agent-advanced-label">{AGENT_INPUT_TEXT.advancedLabel}</span>
              <select
                className="agent-type-selector"
                value={taskType}
                onChange={(event) => onTaskTypeChange(event.target.value)}
                disabled={submitMutation.isPending || disabled}
              >
                {taskTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="agent-advanced-hint">{AGENT_INPUT_TEXT.advancedHint}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
