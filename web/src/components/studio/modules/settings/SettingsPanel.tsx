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
          <label className="text-[10px] font-black text-[#a1a1a1] uppercase tracking-[0.2em] px-1 flex items-center gap-2 font-heading">
            <div className="w-1.5 h-1.5 bg-[#0070f3] rounded-full" />
            Access Credentials
          </label>
          <div className="flex gap-4 p-2 bg-[#111111]/30 rounded-3xl border border-[#333333]">
            <input
              type="password"
              className="flex-1 bg-transparent border-none rounded-xl p-4 text-[#ededed] placeholder:text-[#444444] focus:outline-none focus:ring-0 font-mono text-xs tracking-wider"
              placeholder="SK-..."
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            />
            <button
              disabled={saving}
              onClick={() => handleSave("api_key", config.api_key)}
              className="bg-[#0070f3] hover:bg-[#0080ff] text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-heading"
            >
              Update
            </button>
          </div>
          <p className="text-[9px] text-[#444444] px-3 font-mono">Authentication credentials for backend compute nodes.</p>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-[#a1a1a1] uppercase tracking-[0.2em] px-1 flex items-center gap-2 font-heading">
            <div className="w-1.5 h-1.5 bg-[#00e5ff] rounded-full" />
            Network Route
          </label>
          <div className="grid grid-cols-3 gap-3">
            {["auto", "domestic", "overseas"].map((mode) => (
              <button
                key={mode}
                onClick={() => handleSave("host_mode", mode)}
                className={`py-4 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-[0.2em] font-heading ${config.host_mode === mode
                  ? "bg-[#0070f3] border-[#0070f3] text-white shadow-[0_0_20px_rgba(0,112,243,0.3)]"
                  : "bg-[#050505] border-[#333333] text-[#a1a1a1] hover:text-white hover:border-[#666666]"
                  }`}
              >
                {mode === "auto" ? "AUTO" : mode === "domestic" ? "CN_CORE" : "INT_NET"}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-[#444444] px-3 font-mono">Select optimal routing path for API requests based on geographic location.</p>
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
