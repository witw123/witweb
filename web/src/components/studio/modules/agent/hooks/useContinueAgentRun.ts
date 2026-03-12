/**
 * useContinueAgentRun Hook
 *
 * 提供 Agent 任务继续/优化功能
 * 允许用户输入优化指令，对已有任务进行迭代改进
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/** 继续任务的输入参数 */
type ContinueInput = {
  /** 任务 ID */
  runId: string;
  /** 优化指令 */
  instruction: string;
  /** 使用的模型 */
  model: string;
  /** 额外载荷 */
  payload?: Record<string, unknown>;
};

/**
 * useContinueAgentRun - 继续优化 Agent 任务 Hook
 *
 * 对已存在的 Agent 任务发送优化指令，获取改进后的结果
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @param {Object} [options] - 配置选项
 * @param {Function} [options.onSuccess] - 成功回调
 * @param {Function} [options.onError] - 错误回调
 * @returns 包含继续方法和状态的对象
 */
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
    /** 继续优化任务 */
    continueRun: mutation.mutateAsync,
    /** 是否正在处理 */
    continuing: mutation.isPending,
  };
}
