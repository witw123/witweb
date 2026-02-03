"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers";

const ratioOptions = ["16:9", "9:16", "1:1"];
const durationOptions = [10, 15];

export function CreateForm() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);

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
      const payload = {
        ...formData,
        duration: Number(formData.duration),
        webHook: "-1",
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
        setStatus({ type: "success", msg: `任务创建成功，任务ID: ${data.task_id}` });
        setFormData((prev) => ({ ...prev, prompt: "", url: "", remixTargetId: "" }));
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
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl space-y-12">
      {/* Prompt Input */}
      <div>
        <label className="studio-label text-center block">画面描述</label>
        <textarea
          required
          className="studio-input studio-textarea"
          placeholder="描述您想生成的电影级画面..."
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
        />
      </div>

      {/* Options Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Aspect Ratio */}
        <div>
          <p className="studio-label text-center">画幅比例</p>
          <div className="studio-toggle-group">
            {ratioOptions.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setFormData({ ...formData, aspectRatio: ratio })}
                className={`studio-toggle-item ${formData.aspectRatio === ratio ? 'active' : ''}`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className="studio-label text-center">生成时长</p>
          <div className="studio-toggle-group">
            {durationOptions.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setFormData({ ...formData, duration: sec })}
                className={`studio-toggle-item ${formData.duration === sec ? 'active' : ''}`}
              >
                {sec}秒
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Settings - Always Visible */}
      <div className="pt-8 border-t border-[#222] space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="studio-label text-center">参考图片</label>
            <div className="flex flex-col items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReferenceImage(e.target.files?.[0] || null)}
                className="studio-input"
              />
              {referenceImage && (
                <p className="text-xs text-[#888]">已选择: {referenceImage.name}</p>
              )}
            </div>
          </div>
          <div>
            <label className="studio-label text-center">Remix 目标 ID</label>
            <input
              type="text"
              className="studio-input"
              placeholder="输入 PID..."
              value={formData.remixTargetId}
              onChange={(e) => setFormData({ ...formData, remixTargetId: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="studio-label text-center">输出清晰度</label>
          <select
            className="studio-input"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
          >
            <option value="small">720P 标准</option>
            <option value="large">1080P / 4K</option>
          </select>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`studio-status ${status.type === "success" ? "studio-status-success" : "studio-status-error"}`}>
          <div className="studio-status-dot" />
          {status.msg}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !formData.prompt.trim()}
        className="studio-btn studio-btn-primary w-full py-4 mt-8"
      >
        {loading ? "提交中..." : "开始生成视频"}
      </button>
    </form>
  );
}

