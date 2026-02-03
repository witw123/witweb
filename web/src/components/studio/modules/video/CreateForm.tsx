"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers";

export function CreateForm() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [formData, setFormData] = useState({
    prompt: "",
    model: "sora-2",
    aspectRatio: "16:9",
    size: "small",
    duration: 10,
    url: "",
    remixTargetId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setStatus(null);

    try {
      // API expects numeric duration
      const payload = {
        ...formData,
        duration: Number(formData.duration),
        webHook: "-1", // Use polling mode as per docs
      };

      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "任务已进入队列！任务ID: " + data.task_id });
        setFormData(prev => ({ ...prev, prompt: "", url: "", remixTargetId: "" }));
      } else {
        throw new Error(data.detail || "提交失败");
      }
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="space-y-6">
          <label className="text-base font-bold text-[#a1a1a1] px-1 flex justify-between items-center font-heading">
            <span>画面描述</span>
            <span className="text-[10px] bg-[#0070f3]/10 text-[#0070f3] px-3 py-1 rounded-full border border-[#0070f3]/20 font-mono tracking-widest">ENHANCED MODE</span>
          </label>
          <textarea
            required
            className="w-full h-48 bg-[#0a0a0a] border border-[#333333] rounded-[2rem] p-8 text-[#ededed] placeholder:text-[#444444] focus:outline-none focus:border-[#0070f3] focus:ring-4 focus:ring-[#0070f3]/10 transition-all resize-none shadow-inner text-lg leading-relaxed tracking-wide"
            placeholder="描述您想生成的电影级画面..."
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-5">
            <label className="text-sm font-bold text-[#a1a1a1] px-1 font-heading">画幅比例</label>
            <div className="grid grid-cols-3 gap-5">
              {["16:9", "9:16", "1:1"].map(ratio => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setFormData({ ...formData, aspectRatio: ratio })}
                  className={`py-4 rounded-2xl text-xs font-bold tracking-widest transition-all border ${formData.aspectRatio === ratio
                    ? "bg-[#0070f3] border-[#0070f3] text-white shadow-[0_0_20px_rgba(0,112,243,0.3)]"
                    : "bg-[#111111] border-[#333333] text-[#a1a1a1] hover:border-[#444444] hover:text-white"
                    }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <label className="text-sm font-bold text-[#a1a1a1] px-1 font-heading">生成时长</label>
            <div className="grid grid-cols-2 gap-5">
              {[10, 15].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setFormData({ ...formData, duration: sec })}
                  className={`py-4 rounded-2xl text-xs font-bold tracking-widest transition-all border ${formData.duration === sec
                    ? "bg-[#0070f3] border-[#0070f3] text-white shadow-[0_0_20px_rgba(0,112,243,0.3)]"
                    : "bg-[#111111] border-[#333333] text-[#a1a1a1] hover:border-[#444444] hover:text-white"
                    }`}
                >
                  {sec}秒 序列
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-bold text-[#444444] hover:text-[#0070f3] flex items-center gap-3 transition-all tracking-wider uppercase p-2 group"
          >
            <div className={`h-[2px] bg-current transition-all group-hover:w-12 ${showAdvanced ? 'w-8' : 'w-4'}`} />
            高级控制面板
          </button>

          {showAdvanced && (
            <div className="mt-8 p-10 bg-[#111111]/50 border border-[#333333] rounded-[2.5rem] space-y-8 animate-in slide-in-from-top-4 duration-500 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              </div>

              <div className="space-y-4 relative">
                <label className="text-xs font-bold text-[#a1a1a1] px-1 font-heading">参考图链接</label>
                <input
                  type="text"
                  className="w-full bg-[#050505] border border-[#333333] rounded-2xl p-5 text-sm text-[#ededed] focus:outline-none focus:border-[#0070f3] transition-all font-mono"
                  placeholder="请输入图片 URL..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-8 relative">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-[#a1a1a1] px-1 font-heading">混音目标 ID</label>
                  <input
                    type="text"
                    className="w-full bg-[#050505] border border-[#333333] rounded-2xl p-5 text-sm text-[#ededed] focus:outline-none focus:border-[#0070f3] transition-all font-mono"
                    placeholder="输入 PID..."
                    value={formData.remixTargetId}
                    onChange={(e) => setFormData({ ...formData, remixTargetId: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold text-[#a1a1a1] px-1 font-heading">输出精度</label>
                  <select
                    className="w-full bg-[#050505] border border-[#333333] rounded-2xl p-5 text-sm text-[#ededed] focus:outline-none focus:border-[#0070f3] transition-all font-heading appearance-none cursor-pointer"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  >
                    <option value="small">标准 (720P)</option>
                    <option value="large">高清 (1080P/4K)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {status && (
          <div className={`p-5 rounded-2xl text-xs font-bold tracking-widest uppercase flex items-center gap-4 animate-in zoom-in-95 duration-300 ${status.type === "success" ? "bg-[#0070f3]/10 text-[#00e5ff] border border-[#0070f3]/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status.type === "success" ? "bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]" : "bg-red-500 shadow-[0_0_10px_#ef4444]"}`} />
            {status.msg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !formData.prompt.trim()}
          className="w-full bg-[#0070f3] hover:bg-[#0080ff] disabled:bg-[#111111] disabled:text-[#444444] text-white font-extrabold py-5 rounded-3xl shadow-[0_20px_40px_rgba(0,112,243,0.2)] transition-all active:scale-[0.98] flex items-center justify-center gap-4 overflow-hidden group relative uppercase tracking-[0.2em] text-sm font-heading"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>开始生成视频</span>
              <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7" />
              </svg>
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
        </button>
      </form>
    </div>
  );
}
