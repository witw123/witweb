"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";

type PingPayload = {
  ok?: boolean;
  latency_ms?: number;
  message?: string;
};

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
    pingInfo,
    pinging: mutation.isPending,
    pingProvider: () => mutation.mutateAsync(),
  };
}
