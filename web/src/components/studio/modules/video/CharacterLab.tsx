"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function CharacterLab() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"upload" | "create">("upload");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const [uploadData, setUploadData] = useState({ url: "", timestamps: "0,3" });
  const [createData, setCreateData] = useState({ pid: "", timestamps: "0,3" });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("请先登录");

      const endpoint =
        mode === "upload"
          ? getVersionedApiPath("/video/upload-character")
          : getVersionedApiPath("/video/create-character");
      const payload = mode === "upload" ? uploadData : createData;

      return post<{ task_id?: string; id?: string }>(endpoint, payload);
    },
    onMutate: () => {
      setStatus(null);
    },
    onSuccess: async (data) => {
      const taskId = data.task_id || data.id || "";
      setStatus({
        type: "success",
        msg: `角色任务已提交，任务 ID：${taskId}`,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.videoTasks() });
    },
    onError: (err) => {
      setStatus({ type: "error", msg: errorMessage(err, "提交失败") });
    },
  });

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">角色管理</h3>
          <p className="studio-section-desc">
            上传角色素材，或基于已有视频 PID 创建角色。
          </p>
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitMutation.mutateAsync();
          }}
          className="space-y-5"
        >
          <div>
            <label className="studio-label">
              {mode === "upload" ? "素材链接" : "视频 PID"}
            </label>
            <input
              type="text"
              required
              className="studio-input"
              placeholder={
                mode === "upload" ? "请输入视频 URL 或 Base64..." : "请输入视频 PID..."
              }
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
              value={
                mode === "upload" ? uploadData.timestamps : createData.timestamps
              }
              onChange={(e) =>
                mode === "upload"
                  ? setUploadData({ ...uploadData, timestamps: e.target.value })
                  : setCreateData({ ...createData, timestamps: e.target.value })
              }
            />
            <p className="mt-2 text-xs text-[#666]">
              格式：开始秒数,结束秒数（最长 3 秒）
            </p>
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

          <div className="studio-action-row">
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="studio-btn studio-btn-primary min-w-[180px] py-3"
            >
              {submitMutation.isPending ? "提交中..." : "提交角色任务"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
