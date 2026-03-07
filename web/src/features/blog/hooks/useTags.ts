"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

type TagItem = {
  tag: string;
  count: number;
};

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
