"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

export type RadarItem = {
  id: number;
  source_id: number;
  source_name: string;
  title: string;
  url: string;
  summary: string;
  published_at: string;
  score: number;
};

type RadarAnalysisResult = {
  summary: string;
  keywords: string[];
  angles: string[];
  risks: string[];
  markdown: string;
};

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
    items: itemsQuery.data || [],
    loadingItems: itemsQuery.isLoading,
    refreshingItems: itemsQuery.isFetching,
    refreshItems: () => itemsQuery.refetch(),
    clearItems: clearItemsMutation.mutateAsync,
    clearingItems: clearItemsMutation.isPending,
    analyze: analyzeMutation.mutateAsync,
    analyzing: analyzeMutation.isPending,
    analysisResult: analyzeMutation.data?.analysis || null,
  };
}
