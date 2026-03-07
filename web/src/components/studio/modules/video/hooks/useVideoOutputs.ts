"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, getPaginated, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { VideoTask } from "@/types";

export type VideoOutput = {
  name: string;
  size: number;
  mtime: number;
  url: string;
  task_id: string | null;
  generated_time: number;
  duration_seconds: number | null;
  prompt: string;
};

export function useVideoOutputs(isAuthenticated: boolean) {
  const queryClient = useQueryClient();

  const outputsQuery = useQuery({
    queryKey: queryKeys.videoOutputs,
    queryFn: () => get<VideoOutput[]>(getVersionedApiPath("/video/outputs")),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const succeededTasksQuery = useQuery({
    queryKey: queryKeys.videoTasks({ limit: 100, status: "succeeded" }),
    queryFn: async () => {
      const result = await getPaginated<VideoTask>(
        getVersionedApiPath("/video/tasks"),
        { page: 1, limit: 100 }
      );
      return result.items.filter((task) => task.status === "succeeded");
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const deleteOutputMutation = useMutation({
    mutationFn: (name: string) =>
      del(getVersionedApiPath(`/video/outputs/${encodeURIComponent(name)}`)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.videoOutputs });
    },
  });

  const finalizeOutputMutation = useMutation({
    mutationFn: (input: { id: string; prompt?: string }) =>
      post(getVersionedApiPath("/video/outputs/finalize"), input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.videoOutputs }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.videoTasks({ limit: 100, status: "succeeded" }),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.videoTasks({ limit: 30 }) }),
      ]);
    },
  });

  return {
    outputs: outputsQuery.data || [],
    succeededTasks: succeededTasksQuery.data || [],
    loadingOutputs: outputsQuery.isLoading,
    refreshingOutputs: outputsQuery.isFetching,
    refreshOutputs: () => outputsQuery.refetch(),
    deleteOutput: deleteOutputMutation.mutateAsync,
    deletingOutput: deleteOutputMutation.isPending,
    finalizeOutput: finalizeOutputMutation.mutateAsync,
    finalizingOutput: finalizeOutputMutation.isPending,
  };
}
