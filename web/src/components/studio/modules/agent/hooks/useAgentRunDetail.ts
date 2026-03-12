/**
 * useAgentRunDetail Hook
 *
 * 提供 Agent 任务详情查询功能
 * 获取特定任务的详细信息和产物列表
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/** Agent 任务类型 */
export type AgentType = "topic" | "writing" | "publish";

/**
 * 任务列表项
 */
export type RunListItem = {
  /** 任务 ID */
  id: string;
  /** 任务目标 */
  goal: string;
  /** 任务类型 */
  agent_type: AgentType;
  /** 任务状态 */
  status: string;
  /** 使用的模型 */
  model?: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
};

/**
 * 任务产物项
 */
export type ArtifactItem = {
  /** 产物 ID */
  id: number;
  /** 产物类型 */
  kind: "title" | "content" | "tags" | "seo" | "cover_prompt";
  /** 产物内容 */
  content: string;
  /** 创建时间 */
  created_at: string;
};

/** 任务详情 */
export type RunDetail = {
  /** 任务信息 */
  run: RunListItem;
  /** 产物列表 */
  artifacts: ArtifactItem[];
};

/**
 * useAgentRunDetail - Agent 任务详情 Hook
 *
 * 获取特定 Agent 任务的详细信息和产物列表
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @param {string} runId - 任务 ID
 * @param {boolean} enabled - 是否启用查询
 * @returns 包含任务详情及刷新方法的对象
 */
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

  /**
   * 手动刷新任务详情
   *
   * @param {string} [targetRunId] - 指定要刷新的任务 ID，默认当前任务
   * @returns {Promise<RunDetail | null>}
   */
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
    /** 任务详情数据 */
    detail: query.data || null,
    /** 错误信息 */
    detailError: query.error instanceof Error ? query.error.message : "",
    /** 刷新详情方法 */
    refreshDetail,
  };
}
