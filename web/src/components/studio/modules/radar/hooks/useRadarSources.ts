"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

export type RadarSource = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "html" | "api";
  parser_config_json?: string;
  enabled: number;
  last_fetch_status?: "idle" | "ok" | "failed";
  last_fetch_error?: string;
  last_fetched_at?: string | null;
  last_fetch_count?: number;
  updated_at: string;
};

type SourcePayload = {
  name: string;
  url: string;
  type: "rss" | "html" | "api";
  parser_config_json: string;
  enabled: boolean;
};

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
    sources: sourcesQuery.data || [],
    loadingSources: sourcesQuery.isLoading,
    refreshingSources: sourcesQuery.isFetching,
    refreshSources: () => sourcesQuery.refetch(),
    saveSource: saveSourceMutation.mutateAsync,
    savingSource: saveSourceMutation.isPending,
    deleteSource: deleteSourceMutation.mutateAsync,
    deletingSource: deleteSourceMutation.isPending,
    fetchNow: fetchNowMutation.mutateAsync,
    fetchingNow: fetchNowMutation.isPending,
  };
}
