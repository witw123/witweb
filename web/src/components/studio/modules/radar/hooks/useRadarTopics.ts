"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

export type RadarTopic = {
  id: number;
  kind: "item" | "analysis";
  title: string;
  summary: string;
  content: string;
  source_name: string;
  source_url: string;
  score: number;
  tags?: string[];
  created_at: string;
};

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
    topics: topicsQuery.data || [],
    loadingTopics: topicsQuery.isLoading,
    refreshingTopics: topicsQuery.isFetching,
    refreshTopics: () => topicsQuery.refetch(),
    saveTopic: saveTopicMutation.mutateAsync,
    savingTopic: saveTopicMutation.isPending,
    deleteTopic: deleteTopicMutation.mutateAsync,
    deletingTopic: deleteTopicMutation.isPending,
  };
}
