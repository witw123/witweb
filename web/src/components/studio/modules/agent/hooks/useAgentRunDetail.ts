"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

export type AgentType = "topic" | "writing" | "publish";

export type RunListItem = {
  id: string;
  goal: string;
  agent_type: AgentType;
  status: string;
  model?: string;
  created_at: string;
  updated_at: string;
};

export type ArtifactItem = {
  id: number;
  kind: "title" | "content" | "tags" | "seo" | "cover_prompt";
  content: string;
  created_at: string;
};

export type RunDetail = {
  run: RunListItem;
  artifacts: ArtifactItem[];
};

export function useAgentRunDetail(
  isAuthenticated: boolean,
  runId: string,
  enabled: boolean
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.agentRunDetail(runId || "idle"),
    queryFn: async () =>
      get<RunDetail>(getVersionedApiPath(`/agent/runs/${runId}`)),
    enabled: Boolean(isAuthenticated && runId && enabled),
    staleTime: 30 * 1000,
  });

  const refreshDetail = async (targetRunId = runId) => {
    if (!isAuthenticated || !targetRunId) return null;
    return queryClient.fetchQuery({
      queryKey: queryKeys.agentRunDetail(targetRunId),
      queryFn: async () =>
        get<RunDetail>(getVersionedApiPath(`/agent/runs/${targetRunId}`)),
      staleTime: 0,
    });
  };

  return {
    detail: query.data || null,
    detailError: query.error instanceof Error ? query.error.message : "",
    refreshDetail,
  };
}
