"use client";

/**
 * 通知 Hook
 *
 * 提供通知获取和标记已读功能
 */

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { Notification, TabType } from "../types";

/** 通知类型 */
type NotificationTab = Exclude<TabType, "chat">;

/**
 * 使用通知
 *
 * @param {boolean} isAuthenticated - 是否已登录
 * @returns {object} 通知相关方法和状态
 */
export function useNotifications(isAuthenticated: boolean) {
  const [activeType, setActiveType] = useState<NotificationTab | null>(null);

  const notificationsQuery = useQuery({
    queryKey: queryKeys.messageNotifications(activeType || "idle"),
    queryFn: async () => {
      if (!activeType) return [];
      const result = await get<{ items: Notification[] }>(
        `${getVersionedApiPath("/messages/notifications")}?type=${activeType}`
      );
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: Boolean(isAuthenticated && activeType),
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
  });

  const fetchNotifications = useCallback(async (type: NotificationTab) => {
    setActiveType(type);
  }, []);

  const markRead = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await post(getVersionedApiPath("/messages/read-notifications"));
    } catch {}
  }, [isAuthenticated]);

  return {
    notifications: notificationsQuery.data || [],
    loading: notificationsQuery.isLoading || notificationsQuery.isFetching,
    fetchNotifications,
    markRead,
  };
}
