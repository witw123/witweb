/**
 * Video Outputs Hook
 *
 * 提供视频输出文件管理功能
 * 包括获取输出列表、删除输出、最终化输出等操作
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, getPaginated, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { VideoTask } from "@/types";

/**
 * 视频输出文件
 */
export type VideoOutput = {
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** 修改时间戳 */
  mtime: number;
  /** 访问 URL */
  url: string;
  /** 关联的任务 ID */
  task_id: string | null;
  /** 生成时间戳 */
  generated_time: number;
  /** 视频时长（秒） */
  duration_seconds: number | null;
  /** 生成时使用的提示词 */
  prompt: string;
};

/**
 * useVideoOutputs - 视频输出管理 Hook
 *
 * 管理视频输出文件的查询、删除和最终化操作
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @returns 包含输出列表、任务列表及操作方法的对象
 */
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
    /** 视频输出文件列表 */
    outputs: outputsQuery.data || [],
    /** 已完成的任务列表 */
    succeededTasks: succeededTasksQuery.data || [],
    /** 是否正在加载输出列表 */
    loadingOutputs: outputsQuery.isLoading,
    /** 是否正在刷新输出列表 */
    refreshingOutputs: outputsQuery.isFetching,
    /** 手动刷新输出列表 */
    refreshOutputs: () => outputsQuery.refetch(),
    /** 删除输出文件 */
    deleteOutput: deleteOutputMutation.mutateAsync,
    /** 是否正在删除 */
    deletingOutput: deleteOutputMutation.isPending,
    /** 最终化输出（保存为博客） */
    finalizeOutput: finalizeOutputMutation.mutateAsync,
    /** 是否正在最终化 */
    finalizingOutput: finalizeOutputMutation.isPending,
  };
}
