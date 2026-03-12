/**
 * useAgentPing Hook
 *
 * 提供 Agent 服务连接状态检查功能
 * 用于检测 Agent 服务是否可用及响应延迟
 */

"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";

/** Ping 响应载荷 */
type PingPayload = {
  /** 是否成功 */
  ok?: boolean;
  /** 延迟（毫秒） */
  latency_ms?: number;
  /** 响应消息 */
  message?: string;
};

/**
 * useAgentPing - Agent 连接状态检查 Hook
 *
 * 检查 Agent 服务的可用性和响应延迟
 *
 * @param {boolean} isAuthenticated - 用户是否已登录
 * @param {Object} [options] - 配置选项
 * @param {Function} [options.onError] - 错误回调
 * @returns 包含 ping 状态和方法的对象
 */
export function useAgentPing(
  isAuthenticated: boolean,
  options?: {
    onError?: (error: unknown) => void;
  }
) {
  const [pingInfo, setPingInfo] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("未登录");
      return get<PingPayload>(getVersionedApiPath("/agent/ping"));
    },
    onMutate: () => {
      setPingInfo("");
    },
    onSuccess: (payload) => {
      setPingInfo(
        payload.ok
          ? `连接正常 / ${payload.latency_ms}ms`
          : `连接异常 / ${payload.message || "unknown"}`
      );
    },
    onError: (error) => {
      options?.onError?.(error);
      setPingInfo("连接检查失败：网络异常");
    },
  });

  return {
    /** 连接状态信息 */
    pingInfo,
    /** 是否正在检查 */
    pinging: mutation.isPending,
    /** 触发 ping 检查 */
    pingProvider: () => mutation.mutateAsync(),
  };
}
