"use client";

/**
 * 私信消息 Hook
 *
 * 提供私信消息查询功能，支持自动刷新
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { PrivateMessage } from "../types";

/**
 * 获取私信消息列表
 *
 * @param {boolean} isAuthenticated - 是否已登录
 * @param {number|null} conversationId - 会话 ID
 * @returns {object} 消息列表和刷新函数
 */
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
