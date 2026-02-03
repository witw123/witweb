"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers";

export function CharacterLab() {
  const { token } = useAuth();
  const [mode, setMode] = useState<"upload" | "create">("upload");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [uploadData, setUploadData] = useState({ url: "", timestamps: "0,3" });
  const [createData, setCreateData] = useState({ pid: "", timestamps: "0,3" });

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
        setStatus({ type: "success", msg: `角色任务已提交，任务ID: ${data.task_id || data.id}` });
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
    <section className="mx-auto w-full max-w-3xl space-y-8">
      {/* Mode Toggle */}
      <div className="studio-toggle-group">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`studio-toggle-item ${mode === "upload" ? 'active' : ''}`}
        >
          上传角色素材
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`studio-toggle-item ${mode === "create" ? 'active' : ''}`}
        >
          使用已有 PID
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="studio-card space-y-7">
        <div>
          <label className="studio-label">
            {mode === "upload" ? "素材链接" : "角色 PID"}
          </label>
          <input
            type="text"
            required
            className="studio-input"
            placeholder={mode === "upload" ? "输入 URL 或 Base64..." : "输入 PID..."}
            value={mode === "upload" ? uploadData.url : createData.pid}
            onChange={(e) =>
              mode === "upload"
                ? setUploadData({ ...uploadData, url: e.target.value })
                : setCreateData({ ...createData, pid: e.target.value })
            }
          />
        </div>

        <div>
          <label className="studio-label">抽取时间戳</label>
          <input
            type="text"
            required
            className="studio-input"
            placeholder="0,3"
            value={mode === "upload" ? uploadData.timestamps : createData.timestamps}
            onChange={(e) =>
              mode === "upload"
                ? setUploadData({ ...uploadData, timestamps: e.target.value })
                : setCreateData({ ...createData, timestamps: e.target.value })
            }
          />
          <p className="mt-3 text-xs text-[#666] leading-relaxed">
            格式：开始时间,结束时间（秒）
          </p>
        </div>

        {status && (
          <div className={`studio-status ${status.type === "success" ? "studio-status-success" : "studio-status-error"}`}>
            <div className="studio-status-dot" />
            {status.msg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="studio-btn studio-btn-primary w-full py-4"
        >
          {loading ? "提交中..." : "提交角色任务"}
        </button>
      </form>
    </section>
  );
}

