"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { PrivateMessage } from "../types";

export function useMessages(isAuthenticated: boolean, conversationId: number | null) {
  const messagesQuery = useQuery({
    queryKey: queryKeys.messageMessages(conversationId),
    queryFn: async () => {
      if (!isAuthenticated || !conversationId || conversationId === -1) {
        return [];
      }

      const list = await get<PrivateMessage[]>(getVersionedApiPath(`/messages/${conversationId}`));

      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(isAuthenticated && conversationId),
    refetchInterval:
      isAuthenticated && conversationId && conversationId !== -1 ? 5000 : false,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });

  const refreshMessages = useCallback(() => messagesQuery.refetch(), [messagesQuery]);
  const messages =
    !conversationId || conversationId === -1 ? [] : messagesQuery.data || [];

  return {
    messages,
    refreshMessages,
  };
}
