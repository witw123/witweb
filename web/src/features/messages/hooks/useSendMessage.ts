"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isApiClientError, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { logError } from "@/lib/logger";
import { queryKeys } from "@/lib/query-keys";
import type { Conversation } from "../types";

export function useSendMessage(isAuthenticated: boolean) {
  const [sendError, setSendError] = useState("");
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (input: {
      selectedConvId: number | null;
      content: string;
      conversations: Conversation[];
    }) => {
      if (!isAuthenticated || !input.content.trim() || input.selectedConvId === null) {
        return null;
      }

      const conv = input.conversations.find((item) => item.id === input.selectedConvId);
      if (!conv) return null;

      const result = await post<{ conversation_id: number }>(
        getVersionedApiPath("/messages"),
        {
          receiver: conv.other_user.username,
          content: input.content,
        }
      );

      return {
        result,
        receiver: conv.other_user.username,
      };
    },
    onMutate: () => {
      setSendError("");
    },
    onSuccess: async (payload) => {
      const conversationId = payload?.result?.conversation_id ?? null;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.messageConversations }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.messageMessages(conversationId),
        }),
      ]);
    },
    onError: (error, input) => {
      const conv = input.conversations.find((item) => item.id === input.selectedConvId);

      logError({
        source: "messages.send",
        error,
        context: {
          conversationId: input.selectedConvId,
          isAuthenticated,
          receiver: conv?.other_user.username || null,
        },
      });

      setSendError(
        isApiClientError(error) ? error.message : "发送失败，请稍后重试。"
      );
    },
  });

  const sendMessage = async (input: {
    selectedConvId: number | null;
    content: string;
    conversations: Conversation[];
  }) => {
    try {
      const payload = await sendMutation.mutateAsync(input);
      return payload?.result || null;
    } catch {
      return null;
    }
  };

  return {
    sendError,
    setSendError,
    sendMessage,
    sending: sendMutation.isPending,
  };
}
