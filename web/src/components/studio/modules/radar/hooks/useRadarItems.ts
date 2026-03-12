/**
 * Radar Items Hook
 *
 * 提供 Radar 内容条目管理功能
 * 包括获取条目列表、清除条目、AI 分析等操作
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/**
 * Radar 内容条目
 */
export type RadarItem = {
  /** 条目 ID */
  id: number;
  /** 来源 ID */
  source_id: number;
  /** 来源名称 */
  source_name: string;
  /** 标题 */
  title: string;
  /** 链接 */
  url: string;
  /** 摘要 */
  summary: string;
  /** 发布时间 */
  published_at: string;
  /** 相关性评分 */
  score: number;
};

/** AI 分析结果 */
type RadarAnalysisResult = {
  /** 摘要 */
  summary: string;
  /** 关键词 */
  keywords: string[];
  /** 角度分析 */
  angles: string[];
  /** 风险提示 */
  risks: string[];
  /** Markdown 格式的分析结果 */
  markdown: string;
};

/**
 * useRadarItems - Radar 条目管理 Hook
 *
 * 管理 Radar 内容条目的查询、筛选、清除和 AI 分析
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @param {Object} filters - 筛选条件
 * @param {string} [filters.q] - 搜索关键词
 * @param {number} [filters.sourceId] - 数据源 ID
 * @param {number} [filters.limit] - 返回数量限制
 * @returns 包含条目列表及操作方法的对象
 */
export function useRadarItems(
  isAuthenticated: boolean,
  filters: { q?: string; sourceId?: number | null; limit?: number }
) {
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: queryKeys.radarItems(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(filters.limit || 120));
      if (filters.q?.trim()) params.set("q", filters.q.trim());
      if (filters.sourceId) params.set("source_id", String(filters.sourceId));

      const result = await get<{ items: RadarItem[] }>(
        `${getVersionedApiPath("/radar/items")}?${params.toString()}`
      );
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const clearItemsMutation = useMutation({
    mutationFn: async (sourceId?: number | null) => {
      const params = new URLSearchParams();
      if (sourceId) params.set("source_id", String(sourceId));
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return del(`${getVersionedApiPath("/radar/items")}${suffix}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.radarItems() });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (input: {
      limit: number;
      q?: string;
      focus?: string;
      sourceId?: number | null;
    }) =>
      post<{ analysis: RadarAnalysisResult }>(
        getVersionedApiPath("/radar/analyze"),
        {
          limit: input.limit,
          q: input.q,
          focus: input.focus,
          source_id: input.sourceId || undefined,
        }
      ),
  });

  return {
    /** 内容条目列表 */
    items: itemsQuery.data || [],
    /** 是否正在加载条目 */
    loadingItems: itemsQuery.isLoading,
    /** 是否正在刷新条目 */
    refreshingItems: itemsQuery.isFetching,
    /** 手动刷新条目列表 */
    refreshItems: () => itemsQuery.refetch(),
    /** 清除条目 */
    clearItems: clearItemsMutation.mutateAsync,
    /** 是否正在清除 */
    clearingItems: clearItemsMutation.isPending,
    /** AI 分析 */
    analyze: analyzeMutation.mutateAsync,
    /** 是否正在分析 */
    analyzing: analyzeMutation.isPending,
    /** 分析结果 */
    analysisResult: analyzeMutation.data?.analysis || null,
  };
}
