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

    const endpoint = mode === "upload" ? "/api/video/upload-character" : "/api/video/create-character";
    const payload = mode === "upload" ? uploadData : createData;

    setLoading(true);
    setStatus(null);
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
      if (!res.ok) throw new Error(data.detail || "提交失败");
      setStatus({ type: "success", msg: `角色任务已提交，任务 ID：${data.task_id || data.id}` });
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message || "提交失败" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">角色管理</h3>
          <p className="studio-section-desc">上传角色素材，或基于已有视频 PID 创建角色。</p>
        </div>
      </div>

      <div className="studio-form-section">
        <div className="studio-toggle-group mb-5">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`studio-toggle-item ${mode === "upload" ? "active" : ""}`}
          >
            上传角色素材
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`studio-toggle-item ${mode === "create" ? "active" : ""}`}
          >
            使用视频 PID
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="studio-label">{mode === "upload" ? "素材链接" : "视频 PID"}</label>
            <input
              type="text"
              required
              className="studio-input"
              placeholder={mode === "upload" ? "请输入视频 URL 或 Base64..." : "请输入视频 PID..."}
              value={mode === "upload" ? uploadData.url : createData.pid}
              onChange={(e) =>
                mode === "upload"
                  ? setUploadData({ ...uploadData, url: e.target.value })
                  : setCreateData({ ...createData, pid: e.target.value })
              }
            />
          </div>

          <div>
            <label className="studio-label">截取时间段</label>
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
            <p className="mt-2 text-xs text-[#666]">格式：开始秒数,结束秒数（最多 3 秒）</p>
          </div>

          {status && (
            <div className={`studio-status ${status.type === "success" ? "studio-status-success" : "studio-status-error"}`}>
              <div className="studio-status-dot" />
              {status.msg}
            </div>
          )}

          <div className="studio-action-row">
            <button type="submit" disabled={loading} className="studio-btn studio-btn-primary min-w-[180px] py-3">
              {loading ? "提交中..." : "提交角色任务"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
