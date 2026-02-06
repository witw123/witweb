"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";

const ratioOptions = ["16:9", "9:16", "1:1"];
const durationOptions = [10, 15];
const qualityOptions = [
  { value: "small", label: "标准清晰度（small）" },
  { value: "large", label: "高清清晰度（large）" },
];
const promptTemplates = [
  "电影感慢镜头，海浪拍打悬崖，金色夕阳，细节丰富。",
  "雨夜赛博朋克街道，霓虹倒影，镜头推进，氛围强烈。",
  "一只橘猫奔跑在向日葵花田，暖色阳光，轻快节奏。",
  "无人机掠过雪山山脊，晨雾流动，史诗感构图。",
];

const STORAGE_KEY = "studio_video_create_form_v3";

type FormData = {
  prompt: string;
  model: string;
  aspectRatio: string;
  size: string;
  duration: number;
  url: string;
  remixTargetId: string;
  webHook: string;
  shutProgress: boolean;
};

interface CreateFormProps {
  onTaskCreated?: (taskId: string) => void;
}

const defaultFormData: FormData = {
  prompt: "",
  model: "sora-2",
  aspectRatio: "16:9",
  size: "small",
  duration: 10,
  url: "",
  remixTargetId: "",
  webHook: "-1",
  shutProgress: false,
};

export function CreateForm({ onTaskCreated }: CreateFormProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [lastTaskId, setLastTaskId] = useState("");
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      setFormData({ ...defaultFormData, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const promptLength = useMemo(() => formData.prompt.trim().length, [formData.prompt]);

  const uploadReferenceImage = async (file: File) => {
    if (!token) {
      setStatus({ type: "error", msg: "请先登录后再上传参考图。" });
      return;
    }
    setUploadingImage(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error?.message || "参考图上传失败");
      setFormData((prev) => ({ ...prev, url: data.data?.url || "" }));
      setStatus({ type: "success", msg: "参考图已上传，可直接提交任务。" });
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message || "参考图上传失败" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setStatus({ type: "error", msg: "请先登录后再提交任务。" });
      return;
    }
    if (!formData.prompt.trim()) {
      setStatus({ type: "error", msg: "提示词不能为空。" });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const payload = {
        ...formData,
        prompt: formData.prompt.trim(),
        duration: Number(formData.duration),
      };
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error?.message || "任务提交失败");
      const taskId = data.data?.task_id || data.data?.id;
      setLastTaskId(taskId || "");
      setStatus({ type: "success", msg: `任务创建成功：${taskId}` });
      onTaskCreated?.(taskId);
      setFormData((prev) => ({ ...prev, prompt: "", remixTargetId: "" }));
    } catch (err: any) {
      setStatus({ type: "error", msg: err.message || "任务提交失败" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">新建视频任务</h3>
          <p className="studio-section-desc">填写提示词与参数，提交后可在任务列表查看实时进度。</p>
        </div>
      </div>

      <section className="studio-form-section">
        <div className="mb-3 flex items-center justify-between">
          <label className="studio-label !mb-0">提示词</label>
          <span className="text-xs text-[#8c8c8c]">建议 20-200 字</span>
        </div>
        <textarea
          required
          className="studio-input studio-textarea"
          placeholder="描述你想生成的视频内容（人物、场景、镜头、光线、风格等）..."
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-[#888]">
          <span>当前 {promptLength} 字</span>
          <button
            type="button"
            className="text-[#8fb8ff] transition-colors hover:text-white"
            onClick={() => setFormData((prev) => ({ ...prev, prompt: "" }))}
          >
            清空提示词
          </button>
        </div>
      </section>

      <section className="studio-form-section">
        <div className="mb-3 text-sm font-semibold text-white">快捷模板</div>
        <div className="grid gap-2 md:grid-cols-2">
          {promptTemplates.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-xl border border-[#2a2a2a] bg-[#12151b] px-3 py-2 text-left text-xs text-[#b8c3d9] transition hover:border-[#3e4d6b] hover:text-white"
              onClick={() => setFormData((prev) => ({ ...prev, prompt: item }))}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="studio-field-grid">
        <section className="studio-form-section !mb-0">
          <p className="studio-label">画幅比例</p>
          <div className="studio-toggle-group">
            {ratioOptions.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setFormData({ ...formData, aspectRatio: ratio })}
                className={`studio-toggle-item ${formData.aspectRatio === ratio ? "active" : ""}`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </section>

        <section className="studio-form-section !mb-0">
          <p className="studio-label">视频时长</p>
          <div className="studio-toggle-group">
            {durationOptions.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setFormData({ ...formData, duration: sec })}
                className={`studio-toggle-item ${formData.duration === sec ? "active" : ""}`}
              >
                {sec} 秒
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="studio-form-section">
        <div className="mb-4 text-sm font-semibold text-white">高级参数</div>
        <div className="studio-field-grid">
          <div>
            <label className="studio-label">上传参考图</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadReferenceImage(file);
              }}
              className="studio-input"
            />
            {uploadingImage && <p className="mt-2 text-xs text-[#888]">参考图上传中...</p>}
          </div>

          <div>
            <label className="studio-label">参考图 URL / Base64</label>
            <input
              type="text"
              className="studio-input"
              placeholder="可粘贴 URL 或 Base64"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            />
          </div>

          <div>
            <label className="studio-label">续作目标 PID（可选）</label>
            <input
              type="text"
              className="studio-input"
              placeholder="例如：s_xxxxx"
              value={formData.remixTargetId}
              onChange={(e) => setFormData({ ...formData, remixTargetId: e.target.value })}
            />
          </div>

          <div>
            <label className="studio-label">清晰度</label>
            <select
              className="studio-input"
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
            >
              {qualityOptions.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {status && (
        <div className={`studio-status ${status.type === "success" ? "studio-status-success" : "studio-status-error"}`}>
          <div className="studio-status-dot" />
          {status.msg}
        </div>
      )}

      <div className="studio-action-row">
        <button
          type="submit"
          disabled={loading || uploadingImage || !formData.prompt.trim()}
          className="studio-btn studio-btn-primary min-w-[180px] py-3"
        >
          {loading ? "提交中..." : "开始生成视频"}
        </button>
        {lastTaskId && (
          <button
            type="button"
            className="studio-btn studio-btn-secondary py-3"
            onClick={() => onTaskCreated?.(lastTaskId)}
          >
            前往任务列表
          </button>
        )}
      </div>
    </form>
  );
}
