"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

type ContinueInput = {
  runId: string;
  instruction: string;
  model: string;
  payload?: Record<string, unknown>;
};

export function useContinueAgentRun(
  isAuthenticated: boolean,
  options?: {
    onSuccess?: (runId: string) => Promise<void> | void;
    onError?: (error: unknown, input: ContinueInput) => void;
  }
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: ContinueInput) => {
      if (!isAuthenticated) throw new Error("未登录");
      if (!input.runId || !input.instruction.trim()) {
        throw new Error("请输入优化指令");
      }

      await post(
        getVersionedApiPath(`/agent/runs/${input.runId}/continue`),
        {
          instruction: input.instruction.trim(),
          model: input.model,
          ...(input.payload || {}),
        }
      );

      return input.runId;
    },
    onSuccess: async (runId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agentGallery }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agentRunDetail(runId) }),
      ]);
      await options?.onSuccess?.(runId);
    },
    onError: (error, input) => {
      options?.onError?.(error, input);
    },
  });

  return {
    continueRun: mutation.mutateAsync,
    continuing: mutation.isPending,
  };
}
