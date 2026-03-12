/**
 * Radar Sources Hook
 *
 * 提供 Radar 数据源管理功能
 * 包括获取源列表、添加/编辑/删除源、手动触发抓取等操作
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/**
 * Radar 数据源
 */
export type RadarSource = {
  /** 源 ID */
  id: number;
  /** 源名称 */
  name: string;
  /** 源 URL */
  url: string;
  /** 源类型 */
  type: "rss" | "html" | "api";
  /** 解析器配置 JSON */
  parser_config_json?: string;
  /** 是否启用 */
  enabled: number;
  /** 上次抓取状态 */
  last_fetch_status?: "idle" | "ok" | "failed";
  /** 上次抓取错误信息 */
  last_fetch_error?: string;
  /** 上次抓取时间 */
  last_fetched_at?: string | null;
  /** 上次抓取条目数 */
  last_fetch_count?: number;
  /** 更新时间 */
  updated_at: string;
};

/** 数据源创建/更新载荷 */
type SourcePayload = {
  name: string;
  url: string;
  type: "rss" | "html" | "api";
  parser_config_json: string;
  enabled: boolean;
};

/**
 * useRadarSources - Radar 源管理 Hook
 *
 * 管理 Radar 数据源的 CRUD 操作和手动抓取
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @returns 包含源列表及操作方法的对象
 */
export function useRadarSources(isAuthenticated: boolean) {
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({
    queryKey: queryKeys.radarSources,
    queryFn: async () => {
      const result = await get<{ items: RadarSource[] }>(getVersionedApiPath("/radar/sources"));
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const saveSourceMutation = useMutation({
    mutationFn: async (input: { sourceId?: number | null; payload: SourcePayload }) => {
      const endpoint = input.sourceId
        ? getVersionedApiPath(`/radar/sources/${input.sourceId}`)
        : getVersionedApiPath("/radar/sources");
      const method = input.sourceId ? patch : post;
      return method(endpoint, input.payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.radarSources });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: number) =>
      del(getVersionedApiPath(`/radar/sources/${sourceId}`)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.radarSources }),
        queryClient.invalidateQueries({ queryKey: queryKeys.radarItems() }),
      ]);
    },
  });

  const fetchNowMutation = useMutation({
    mutationFn: async (sourceId?: number) =>
      post(
        getVersionedApiPath("/radar/fetch"),
        sourceId ? { source_id: sourceId } : {}
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.radarSources }),
        queryClient.invalidateQueries({ queryKey: queryKeys.radarItems() }),
      ]);
    },
  });

  return {
    /** 数据源列表 */
    sources: sourcesQuery.data || [],
    /** 是否正在加载源列表 */
    loadingSources: sourcesQuery.isLoading,
    /** 是否正在刷新源列表 */
    refreshingSources: sourcesQuery.isFetching,
    /** 手动刷新源列表 */
    refreshSources: () => sourcesQuery.refetch(),
    /** 创建或更新数据源 */
    saveSource: saveSourceMutation.mutateAsync,
    /** 是否正在保存 */
    savingSource: saveSourceMutation.isPending,
    /** 删除数据源 */
    deleteSource: deleteSourceMutation.mutateAsync,
    /** 是否正在删除 */
    deletingSource: deleteSourceMutation.isPending,
    /** 手动触发抓取 */
    fetchNow: fetchNowMutation.mutateAsync,
    /** 是否正在抓取 */
    fetchingNow: fetchNowMutation.isPending,
  };
}
