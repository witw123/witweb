"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers";

export function CharacterLab() {
  const { token } = useAuth();
  const [mode, setMode] = useState<"upload" | "create">("upload");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [uploadData, setUploadData] = useState({
    url: "",
    timestamps: "0,3",
  });

  const [createData, setCreateData] = useState({
    pid: "",
    timestamps: "0,3",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setStatus(null);

    const endpoint = mode === "upload" ? "/api/video/upload-character" : "/api/video/create-character";
    const payload = mode === "upload" ? uploadData : createData;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", msg: "角色创建任务提交成功！任务ID: " + (data.task_id || data.id) });
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
    <div className="max-w-3xl mx-auto space-y-10 py-8">
      <div className="bg-[#111111] p-1.5 rounded-2xl border border-[#333333] flex">
        <button
          onClick={() => setMode("upload")}
          className={`flex-1 py-4 rounded-xl text-sm font-bold tracking-[0.1em] transition-all duration-300 ${mode === "upload" ? "bg-[#333333] text-white shadow-md" : "text-[#888888] hover:text-[#ededed]"
            }`}
        >
          上传角色源
        </button>
        <button
          onClick={() => setMode("create")}
          className={`flex-1 py-4 rounded-xl text-sm font-bold tracking-[0.1em] transition-all duration-300 ${mode === "create" ? "bg-[#333333] text-white shadow-md" : "text-[#888888] hover:text-[#ededed]"
            }`}
        >
          提取已有特征
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-[#0a0a0a] p-10 rounded-3xl border border-[#222222]">
        <div className="space-y-4">
          <label className="text-sm font-bold text-[#a1a1a1] px-1 font-heading">
            {mode === "upload" ? "身份视频源链接" : "参考内容标识符 (PID)"}
          </label>
          <input
            type="text"
            required
            className="w-full bg-[#111111] border border-[#333333] rounded-2xl p-5 text-[#ededed] placeholder:text-[#444444] focus:outline-none focus:border-[#0070f3] transition-all font-mono text-sm tracking-wider"
            placeholder={mode === "upload" ? "请输入 URL 或 Base64..." : "请输入 PID..."}
            value={mode === "upload" ? uploadData.url : createData.pid}
            onChange={(e) => mode === "upload"
              ? setUploadData({ ...uploadData, url: e.target.value })
              : setCreateData({ ...createData, pid: e.target.value })
            }
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-[#a1a1a1] px-1 flex justify-between font-heading">
            <span>提取时间窗口</span>
            <span className="text-[10px] text-[#0070f3] bg-[#0070f3]/10 px-2 py-1 rounded border border-[#0070f3]/20 font-mono">精准模式</span>
          </label>
          <input
            type="text"
            required
            className="w-full bg-[#111111] border border-[#333333] rounded-2xl p-5 text-[#ededed] focus:outline-none focus:border-[#0070f3] transition-all font-mono text-sm tracking-widest"
            placeholder="0,3"
            value={mode === "upload" ? uploadData.timestamps : createData.timestamps}
            onChange={(e) => mode === "upload"
              ? setUploadData({ ...uploadData, timestamps: e.target.value })
              : setCreateData({ ...createData, timestamps: e.target.value })
            }
          />
          <p className="text-[11px] text-[#555555] px-1 font-mono tracking-wide">格式: 开始秒,结束秒 (最大 3.0秒)</p>
        </div>

        {status && (
          <div className={`p-4 rounded-xl text-xs font-bold tracking-wide flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${status.type === "success" ? "bg-[#0070f3]/10 text-[#00e5ff] border border-[#0070f3]/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status.type === "success" ? "bg-[#00e5ff]" : "bg-red-500"}`} />
            {status.msg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0070f3] hover:bg-[#0080ff] disabled:bg-[#111111] disabled:text-[#444444] text-white font-bold py-5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 tracking-widest text-sm"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>开始提取</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="bg-[#111111] border border-[#222222] rounded-3xl p-8 space-y-4">
        <h4 className="text-xs font-bold text-[#ededed] flex items-center gap-3">
          <div className="w-1 h-4 bg-[#0070f3] rounded-full" />
          身份协议说明
        </h4>
        <p className="text-xs text-[#888888] leading-relaxed">
          提取成功后，您将获得一个唯一的 <strong className="text-[#0070f3]">Identity ID</strong>。
          <br />
          在创作视频时，请将此 ID 填入 "高级控制" 面板中的混音目标字段。
        </p>
      </div>
    </div>
  );
}
