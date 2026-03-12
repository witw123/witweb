"use client";

/**
 * 标签 Hook
 *
 * 获取文章标签列表
 */

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/** 标签项 */
type TagItem = {
  tag: string;
  count: number;
};

/**
 * 获取标签列表
 *
 * @param {number} [limit=12] - 返回标签数量限制
 * @returns {object} 标签列表和相关状态
 */
export function useTags(limit = 12) {
  const query = useQuery({
    queryKey: queryKeys.tags(limit),
    queryFn: async () => {
      const result = await get<{ tags: TagItem[] }>(getVersionedApiPath("/tags"));
      return Array.isArray(result.tags) ? result.tags.slice(0, limit) : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    tags: query.data || [],
    status: query.status,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}
