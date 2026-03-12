"use client";

/**
 * SettingsPanel 视频中心设置面板组件
 *
 * 提供视频生成功能的配置选项：
 * - API 密钥管理
 * - 线路模式选择（自动/国内/海外）
 *
 * @component
 * @example
 * <SettingsPanel />
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

/**
 * 从错误对象中提取错误信息
 */
function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/**
 * 视频配置响应类型
 */
type VideoConfigResponse = {
  host_mode?: "auto" | "domestic" | "overseas";
  query_defaults?: Record<string, unknown>;
};

/**
 * SettingsPanel 组件 - 视频中心设置
 */
export function SettingsPanel() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [apiKey, setApiKey] = useState("");

  const configQuery = useQuery({
    queryKey: queryKeys.videoConfig,
    queryFn: async () => get<VideoConfigResponse>(getVersionedApiPath("/video/config")),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const hostMode = useMemo(
    () => configQuery.data?.host_mode || "auto",
    [configQuery.data?.host_mode]
  );

  const saveMutation = useMutation({
    mutationFn: async (input: { key: "api_key" | "host_mode"; value: string }) => {
      if (!isAuthenticated) throw new Error("未登录");

      const body =
        input.key === "api_key"
          ? { api_key: input.value }
          : { host_mode: input.value };

      await post(getVersionedApiPath("/video/config"), body);
      return input;
    },
    onMutate: () => {
      setStatus(null);
    },
    onSuccess: async ({ key }) => {
      setStatus({ type: "success", msg: "设置已保存" });
      if (key === "api_key") {
        setApiKey("");
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.videoConfig });
    },
    onError: (err) => {
      setStatus({ type: "error", msg: errorMessage(err, "保存失败") });
    },
  });

  const handleSave = (key: "api_key" | "host_mode", value: string) => {
    void saveMutation.mutateAsync({ key, value });
  };

  if (configQuery.isLoading) {
    return <div className="py-16 text-center text-sm text-[#888]">正在加载设置...</div>;
  }

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">中心设置</h3>
          <p className="studio-section-desc">
            配置接口密钥与线路模式，影响所有视频任务请求。
          </p>
        </div>
      </div>

      <div className="studio-form-section">
        <div className="space-y-4">
          <label className="studio-label">API 密钥</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              className="studio-input flex-1"
              placeholder="请输入 API Key（sk-...）"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              disabled={saveMutation.isPending || !apiKey.trim()}
              onClick={() => handleSave("api_key", apiKey)}
              className="studio-btn studio-btn-primary min-w-[120px]"
            >
              保存
            </button>
          </div>
          <p className="text-xs text-[#666]">用于服务端调用视频接口的鉴权凭证。</p>
        </div>

        <div className="mt-6 space-y-4 border-t border-[#222] pt-6">
          <label className="studio-label">线路模式</label>
          <div className="studio-toggle-group">
            {[
              { value: "auto", label: "自动" },
              { value: "domestic", label: "国内" },
              { value: "overseas", label: "海外" },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => handleSave("host_mode", mode.value)}
                className={`studio-toggle-item ${hostMode === mode.value ? "active" : ""}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#666]">自动模式会在可用线路间自动回退重试。</p>
        </div>
      </div>

      {status && (
        <div
          className={`studio-status ${
            status.type === "success"
              ? "studio-status-success"
              : "studio-status-error"
          }`}
        >
          <div className="studio-status-dot" />
          {status.msg}
        </div>
      )}
    </section>
  );
}
