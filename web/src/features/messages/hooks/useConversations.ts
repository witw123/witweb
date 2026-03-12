"use client";

/**
 * 会话列表 Hook
 *
 * 提供私信会话列表查询和会话选择功能
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { Conversation, PublicProfile } from "../types";

/**
 * 获取会话列表
 *
 * @param {boolean} isAuthenticated - 是否已登录
 * @param {string|null} [autoSelectUsername] - 自动选择的用户名
 * @returns {object} 会话列表和相关状态
 */
export function useConversations(isAuthenticated: boolean, autoSelectUsername?: string | null) {
  const [pendingConvState, setPendingConv] = useState<Conversation | null>(null);
  const [selectedConvIdState, setSelectedConvIdState] = useState<number | null>(null);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.messageConversations,
    queryFn: async () => {
      const list = await get<Conversation[]>(getVersionedApiPath("/messages"));
      return Array.isArray(list) ? list : [];
    },
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 10000 : false,
    refetchOnWindowFocus: false,
    staleTime: 15 * 1000,
  });

  const conversations = useMemo(
    () => (isAuthenticated ? conversationsQuery.data || [] : []),
    [conversationsQuery.data, isAuthenticated]
  );
  const autoSelectedConversation = useMemo(
    () =>
      autoSelectUsername
        ? conversations.find((item) => item.other_user.username === autoSelectUsername) || null
        : null,
    [autoSelectUsername, conversations]
  );

  useEffect(() => {
    if (!isAuthenticated || !autoSelectUsername || pendingConvState || autoSelectedConversation) return;

    let cancelled = false;

    void (async () => {
      try {
        const profile = await get<PublicProfile>(
          getVersionedApiPath(`/users/${encodeURIComponent(autoSelectUsername)}/profile`)
        );

        if (cancelled || !profile?.username) return;

        const tempConv: Conversation = {
          id: -1,
          last_message: "点击此处开始发送第一条消息",
          last_time: new Date().toISOString(),
          unread_count: 0,
          other_user: {
            username: profile.username,
            nickname: profile.nickname || profile.username,
            avatar_url: profile.avatar_url || "",
          },
        };

        setPendingConv(tempConv);
        setSelectedConvIdState(-1);
      } catch {
        // Ignore bootstrap failures for temporary conversations.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoSelectUsername, autoSelectedConversation, isAuthenticated, pendingConvState]);

  const pendingConv = isAuthenticated ? pendingConvState : null;
  const selectedConvId = isAuthenticated
    ? selectedConvIdState ?? autoSelectedConversation?.id ?? pendingConv?.id ?? null
    : null;

  const displayConversations = useMemo(() => {
    const nextList = [...conversations];
    if (
      pendingConv &&
      !conversations.find((item) => item.other_user.username === pendingConv.other_user.username)
    ) {
      nextList.unshift(pendingConv);
    }
    return nextList;
  }, [conversations, pendingConv]);

  const refreshConversations = useCallback(() => conversationsQuery.refetch(), [conversationsQuery]);
  const setSelectedConvId = useCallback((value: number | null) => {
    setSelectedConvIdState(value);
    if (value !== -1) {
      setPendingConv(null);
    }
  }, []);

  return {
    conversations,
    displayConversations,
    pendingConv,
    setPendingConv,
    selectedConvId,
    setSelectedConvId,
    loading: isAuthenticated ? conversationsQuery.isLoading : false,
    refreshConversations,
  };
}
