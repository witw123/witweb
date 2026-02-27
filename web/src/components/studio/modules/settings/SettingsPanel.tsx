"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function SettingsPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [config, setConfig] = useState({
    api_key: "",
    host_mode: "auto",
  });

  useEffect(() => {
    if (!token) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/video/config", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setConfig((prev) => ({
          ...prev,
          host_mode: data.host_mode || "auto",
        }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [token]);

  const handleSave = async (key: "api_key" | "host_mode", value: string) => {
    if (!token) return;
    setSaving(true);
    setStatus(null);
    try {
      const endpoint = key === "api_key" ? "/api/video/config/api-key" : "/api/video/config/host-mode";
      const body = key === "api_key" ? { api_key: value } : { host_mode: value };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("保存失败");
      setStatus({ type: "success", msg: "设置已保存" });
      setConfig((prev) => ({ ...prev, [key]: value }));
    } catch (err: unknown) {
      setStatus({ type: "error", msg: errorMessage(err, "保存失败") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-[#888]">正在加载设置...</div>;

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">中心设置</h3>
          <p className="studio-section-desc">配置接口密钥与线路模式，影响所有视频任务请求。</p>
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
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            />
            <button
              disabled={saving || !config.api_key.trim()}
              onClick={() => handleSave("api_key", config.api_key)}
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
                className={`studio-toggle-item ${config.host_mode === mode.value ? "active" : ""}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#666]">自动模式会在可用线路间自动回退重试。</p>
        </div>
      </div>

      {status && (
        <div className={`studio-status ${status.type === "success" ? "studio-status-success" : "studio-status-error"}`}>
          <div className="studio-status-dot" />
          {status.msg}
        </div>
      )}
    </section>
  );
}
