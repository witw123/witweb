"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";

export function SettingsPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [config, setConfig] = useState({
    api_key: "",
    host_mode: "auto",
    token: "",
  });

  useEffect(() => {
    if (!token) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch("/config", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setConfig(prev => ({
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

  const handleSave = async (key: string, value: any) => {
    if (!token) return;
    setSaving(true);
    setStatus(null);
    try {
      const endpoint = key === "api_key" ? "/config/api-key" :
        key === "host_mode" ? "/config/host-mode" : "/config";
      const body = key === "api_key" ? { api_key: value } :
        key === "host_mode" ? { host_mode: value } : { [key]: value };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "设置已保存" });
        setConfig(prev => ({ ...prev, [key]: value }));
      } else {
        throw new Error("保存失败");
      }
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-zinc-500">加载中...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-12">
      <div className="space-y-10">
        <div className="space-y-4">
          <label className="studio-label text-center">访问凭证</label>
          <div className="flex gap-4">
            <input
              type="password"
              className="studio-input flex-1"
              placeholder="SK-..."
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            />
            <button
              disabled={saving}
              onClick={() => handleSave("api_key", config.api_key)}
              className="studio-btn studio-btn-primary px-8"
            >
              更新
            </button>
          </div>
          <p className="text-xs text-[#666] text-center">后端计算节点的身份验证凭证</p>
        </div>

        <div className="space-y-4 pt-8 border-t border-[#222]">
          <label className="studio-label text-center">网络路由</label>
          <div className="grid grid-cols-3 gap-3">
            {["auto", "domestic", "overseas"].map((mode) => (
              <button
                key={mode}
                onClick={() => handleSave("host_mode", mode)}
                className={`studio-toggle-btn ${config.host_mode === mode ? "active" : ""
                  }`}
              >
                {mode === "auto" ? "自动" : mode === "domestic" ? "国内" : "国际"}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#666] text-center">根据地理位置为 API 请求选择最佳路由路径</p>
        </div>
      </div>

      {status && (
        <div className={`p-5 rounded-2xl text-[10px] font-black tracking-widest uppercase animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-3 ${status.type === "success" ? "bg-[#0070f3]/10 text-[#00e5ff] border border-[#0070f3]/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}>
          <div className={`w-2 h-2 rounded-full ${status.type === "success" ? "bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]" : "bg-red-500 shadow-[0_0_10px_#ef4444]"}`} />
          {status.msg}
        </div>
      )}
    </div>
  );
}
