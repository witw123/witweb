"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AgentAttachment,
  AgentConversationDto,
  AgentConversationMessage,
  AgentConversationSummary,
  AgentReplyMeta,
} from "@/features/agent/types";
import { createAgentThinkingStages, upsertAgentThinkingStage } from "@/features/agent/constants";
import { readNdjsonStream, readResponseError } from "@/features/agent/streaming";
import { getErrorMessage, isApiClientError, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";

export interface ConversationStreamInput {
  content: string;
  taskType?: string;
  attachments: AgentAttachment[];
}

export interface ConversationStreamCallbacks {
  onSuccess?: (conversationId: string) => void;
  onError?: (error: string) => void;
  onReset?: () => void;
}

export interface ConversationStreamOptions {
  conversationId: string | null | undefined;
  onConversationReady: (id: string) => void;
  showAdvanced: boolean;
  taskType: string;
  callbacks?: ConversationStreamCallbacks;
}

type ConversationStreamDonePayload = {
  conversation: AgentConversationDto["conversation"];
  user_message: AgentConversationMessage;
  assistant_message: AgentConversationMessage;
  reply_meta: AgentReplyMeta;
  goals?: AgentConversationDto["goals"];
};

interface OptimisticSnapshot {
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  previousConversation?: AgentConversationDto;
  previousConversations?: AgentConversationSummary[];
}

interface ConversationStreamResult {
  conversationId: string;
  data: ConversationStreamDonePayload;
}

type ConversationStreamEvent =
  | { type: "phase"; key: string; title: string; status: "pending" | "running" | "done" }
  | { type: "delta"; message_id: string; chunk: string }
  | { type: "done"; conversation: ConversationStreamDonePayload }
  | { type: "error"; message: string };

export function useConversationStream(options: ConversationStreamOptions) {
  const { conversationId, onConversationReady, showAdvanced, taskType, callbacks } = options;
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const optimisticSnapshotRef = useRef<OptimisticSnapshot | null>(null);

  const updateOptimisticThinking = useCallback(
    (nextConversationId: string, assistantMessageId: string, updater: (meta: AgentReplyMeta | undefined) => AgentReplyMeta) => {
      queryClient.setQueryData<AgentConversationDto>(
        ["agent-conversations", nextConversationId, "detail"],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            messages: current.messages.map((message) =>
              message.id === assistantMessageId
                ? { ...message, meta: updater(message.meta) }
                : message
            ),
          };
        }
      );
    },
    [queryClient]
  );

  const mutation = useMutation<ConversationStreamResult, Error, ConversationStreamInput>({
    mutationFn: async (input: ConversationStreamInput) => {
      const { content, attachments } = input;
      const userContent = content.trim();
      const now = new Date().toISOString();
      const optimisticToken = Date.now().toString(36);
      const userMessageContent = userContent || (attachments.length > 0 ? "[附件]" : "");
      let activeConversationId = conversationId;
      let baseConversation: AgentConversationSummary | null = null;

      // Create new conversation if needed
      if (!activeConversationId) {
        const created = await post<AgentConversationDto>(getVersionedApiPath("/agent/conversations"), {
          title: userMessageContent.slice(0, 24),
        });
        activeConversationId = created.conversation.id;
        baseConversation = created.conversation;
        queryClient.setQueryData(["agent-conversations", activeConversationId, "detail"], created);
        onConversationReady(activeConversationId);
      }

      // Store previous state for rollback
      const previousConversation = queryClient.getQueryData<AgentConversationDto>([
        "agent-conversations",
        activeConversationId,
        "detail",
      ]);
      const previousConversations = queryClient.getQueryData<AgentConversationSummary[]>(["agent-conversations"]);

      // Create optimistic messages
      const optimisticUserMessage: AgentConversationMessage = {
        id: `local-user-${optimisticToken}`,
        conversation_id: activeConversationId,
        role: "user",
        content: userMessageContent,
        goal_id: null,
        created_at: now,
        meta: attachments.length > 0 ? { attachments } : undefined,
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

      // Apply optimistic update to conversation detail
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

      // Apply optimistic update to conversation list
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

      // Store snapshot for rollback
      optimisticSnapshotRef.current = {
        conversationId: activeConversationId,
        assistantMessageId: optimisticAssistantMessage.id,
        userMessageId: optimisticUserMessage.id,
        previousConversation,
        previousConversations,
      };

      // Start streaming request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(getVersionedApiPath(`/agent/conversations/${activeConversationId}/messages/stream`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: userContent,
          task_type: showAdvanced ? taskType || undefined : undefined,
          attachments,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const message = await readResponseError(response, `conversation_stream_failed:${response.status}`);
        throw new Error(message);
      }

      // Process stream
      let result: ConversationStreamDonePayload | null = null;

      const applyPhase = (event: { key: string; title: string; status: "pending" | "running" | "done" }) => {
        updateOptimisticThinking(activeConversationId!, optimisticAssistantMessage.id, (meta) => {
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

      await readNdjsonStream<ConversationStreamEvent>(response.body, async (payload) => {
        if (payload.type === "phase") {
          applyPhase(payload);
        } else if (payload.type === "delta") {
          queryClient.setQueryData<AgentConversationDto>(
            ["agent-conversations", activeConversationId, "detail"],
            (current) => {
              if (!current) return current;
              return {
                ...current,
                messages: current.messages.map((message) =>
                  message.id === optimisticAssistantMessage.id
                    ? { ...message, content: `${message.content || ""}${payload.chunk}`, local_status: "streaming" }
                    : message
                ),
              };
            }
          );
        } else if (payload.type === "done") {
          result = payload.conversation;
        } else if (payload.type === "error") {
          throw new Error(payload.message || "conversation_stream_failed");
        }
      });

      if (!result) {
        throw new Error("conversation_stream_missing_result");
      }

      return { conversationId: activeConversationId, data: result };
    },

    onSuccess: ({ conversationId: nextConversationId, data }) => {
      const snapshot = optimisticSnapshotRef.current;
      abortControllerRef.current = null;
      optimisticSnapshotRef.current = null;

      // Reset input state
      callbacks?.onReset?.();

      // Update conversation detail with real data
      queryClient.setQueryData<AgentConversationDto>(
        ["agent-conversations", nextConversationId, "detail"],
        (current) => {
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
              if (message.id === snapshot?.userMessageId) return data.user_message;
              if (message.id === snapshot?.assistantMessageId) {
                return { ...data.assistant_message, local_status: "finalized" };
              }
              return message;
            }),
            goals: data.goals
              ? [
                  ...current.goals.filter((item) => !data.goals!.some((g) => g.goal.id === item.goal.id)),
                  ...data.goals,
                ]
              : current.goals,
            reply_meta: data.reply_meta,
          };
        }
      );

      // Update conversation list
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
      callbacks?.onSuccess?.(nextConversationId);
    },

    onError: (err) => {
      const snapshot = optimisticSnapshotRef.current;
      const isAbort = err instanceof Error && err.name === "AbortError";

      abortControllerRef.current = null;
      optimisticSnapshotRef.current = null;

      // Handle rollback
      if (snapshot) {
        if (isAbort) {
          // Keep partial content if any
          queryClient.setQueryData<AgentConversationDto>(
            ["agent-conversations", snapshot.conversationId, "detail"],
            (current) => {
              if (!current) return current;
              const streamingMessage = current.messages.find((m) => m.id === snapshot.assistantMessageId);
              if (streamingMessage?.content) {
                return {
                  ...current,
                  messages: current.messages.map((m) =>
                    m.id === snapshot.assistantMessageId ? { ...m, local_status: "stopped" } : m
                  ),
                };
              }
              return {
                ...current,
                messages: current.messages.filter((m) => m.id !== snapshot.assistantMessageId),
              };
            }
          );
        } else {
          const current = queryClient.getQueryData<AgentConversationDto>([
            "agent-conversations",
            snapshot.conversationId,
            "detail",
          ]);
          const streamingMessage = current?.messages.find((m) => m.id === snapshot.assistantMessageId);

          if (streamingMessage?.content) {
            queryClient.setQueryData<AgentConversationDto>(
              ["agent-conversations", snapshot.conversationId, "detail"],
              (currentValue) => {
                if (!currentValue) return currentValue;
                return {
                  ...currentValue,
                  messages: currentValue.messages.map((m) =>
                    m.id === snapshot.assistantMessageId ? { ...m, local_status: "stopped" } : m
                  ),
                };
              }
            );
          } else {
            // Full rollback only when no useful assistant content was received.
            queryClient.setQueryData(
              ["agent-conversations", snapshot.conversationId, "detail"],
              snapshot.previousConversation
            );
            queryClient.setQueryData(["agent-conversations"], snapshot.previousConversations);
          }
        }
      }

      if (isAbort) return;

      // Extract error message
      let errorMessage: string;
      if (isApiClientError(err) && err.details && typeof err.details === "object" && !Array.isArray(err.details)) {
        const fieldErrors = err.details as Record<string, unknown>;
        if (typeof fieldErrors.goal === "string" && fieldErrors.goal.trim()) {
          errorMessage = fieldErrors.goal;
        } else if (typeof fieldErrors.content === "string" && fieldErrors.content.trim()) {
          errorMessage = fieldErrors.content;
        } else {
          errorMessage = getErrorMessage(err);
        }
      } else {
        errorMessage = getErrorMessage(err);
      }

      callbacks?.onError?.(errorMessage);
    },
  });

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    stop,
  };
}
