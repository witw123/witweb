/**
 * Radar Topics Hook
 *
 * 提供 Radar 主题/话题管理功能
 * 包括获取主题列表、保存主题、删除主题等操作
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/**
 * Radar 主题/话题
 */
export type RadarTopic = {
  /** 主题 ID */
  id: number;
  /** 主题类型 */
  kind: "item" | "analysis";
  /** 标题 */
  title: string;
  /** 摘要 */
  summary: string;
  /** 内容 */
  content: string;
  /** 来源名称 */
  source_name: string;
  /** 来源链接 */
  source_url: string;
  /** 评分 */
  score: number;
  /** 标签 */
  tags?: string[];
  /** 创建时间 */
  created_at: string;
};

/** 主题创建载荷 */
type TopicPayload = {
  kind: "item" | "analysis";
  title: string;
  summary?: string;
  content?: string;
  source_name?: string;
  source_url?: string;
  score?: number;
  tags?: string[];
};

/**
 * useRadarTopics - Radar 主题管理 Hook
 *
 * 管理 Radar 主题的查询、筛选、保存和删除操作
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @param {Object} filters - 筛选条件
 * @param {string} [filters.q] - 搜索关键词
 * @param {string} [filters.kind] - 主题类型筛选
 * @param {number} [filters.limit] - 返回数量限制
 * @returns 包含主题列表及操作方法的对象
 */
export function useRadarTopics(
  isAuthenticated: boolean,
  filters: { q?: string; kind?: string; limit?: number }
) {
  const queryClient = useQueryClient();

  const topicsQuery = useQuery({
    queryKey: queryKeys.radarTopics(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(filters.limit || 120));
      if (filters.q?.trim()) params.set("q", filters.q.trim());
      if (filters.kind?.trim()) params.set("kind", filters.kind.trim());

      const result = await get<{ items: RadarTopic[] }>(
        `${getVersionedApiPath("/radar/topics")}?${params.toString()}`
      );
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const saveTopicMutation = useMutation({
    mutationFn: async (payload: TopicPayload) =>
      post(getVersionedApiPath("/radar/topics"), payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.radarTopics() });
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (topicId: number) =>
      del(getVersionedApiPath(`/radar/topics/${topicId}`)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.radarTopics() });
    },
  });

  return {
    /** 主题列表 */
    topics: topicsQuery.data || [],
    /** 是否正在加载主题 */
    loadingTopics: topicsQuery.isLoading,
    /** 是否正在刷新主题 */
    refreshingTopics: topicsQuery.isFetching,
    /** 手动刷新主题列表 */
    refreshTopics: () => topicsQuery.refetch(),
    /** 保存主题 */
    saveTopic: saveTopicMutation.mutateAsync,
    /** 是否正在保存 */
    savingTopic: saveTopicMutation.isPending,
    /** 删除主题 */
    deleteTopic: deleteTopicMutation.mutateAsync,
    /** 是否正在删除 */
    deletingTopic: deleteTopicMutation.isPending,
  };
}
