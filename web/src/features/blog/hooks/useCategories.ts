"use client";

/**
 * 分类 Hook
 *
 * 获取文章分类列表
 */

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { Category } from "@/types/blog";

/**
 * 获取分类列表
 *
 * @returns {object} 分类列表和相关状态
 */
export function useCategories() {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const result = await get<{ items: Category[] }>(getVersionedApiPath("/categories"));
      return Array.isArray(result.items) ? result.items : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    categories: query.data || [],
    status: query.status,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}
