"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/app/providers";
import { useVideoOutputs } from "./hooks/useVideoOutputs";

export function Gallery() {
  const { isAuthenticated } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [finalizingTaskId, setFinalizingTaskId] = useState<string | null>(null);
  const {
    outputs,
    succeededTasks,
    loadingOutputs,
    refreshingOutputs,
    refreshOutputs,
    deleteOutput,
    deletingOutput,
    finalizeOutput,
  } = useVideoOutputs(isAuthenticated);

  const filteredOutputs = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = q
      ? outputs.filter((item) => (item.prompt || item.name).toLowerCase().includes(q))
      : outputs;

    return [...list].sort((a, b) => {
      const av = a.generated_time * 1000;
      const bv = b.generated_time * 1000;
      return sort === "newest" ? bv - av : av - bv;
    });
  }, [outputs, keyword, sort]);

  const pendingFinalizeTasks = useMemo(() => {
    const finalizedTaskIds = new Set(
      outputs.map((item) => item.task_id).filter((value): value is string => Boolean(value))
    );

    return succeededTasks.filter((task) => !finalizedTaskIds.has(task.id));
  }, [outputs, succeededTasks]);

  async function handleDelete(name: string) {
    const ok = window.confirm("确认删除这个本地视频作品吗？");
    if (!ok) return;
    await deleteOutput(name);
  }

  async function handleFinalize(taskId: string, prompt: string | null) {
    setFinalizingTaskId(taskId);
    try {
      await finalizeOutput({ id: taskId, prompt: prompt || "" });
    } finally {
      setFinalizingTaskId(null);
    }
  }

  if (loadingOutputs) {
    return <div className="py-16 text-center text-sm text-[#888]">正在加载作品...</div>;
  }

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">作品库</h3>
          <p className="studio-section-desc">
            查看本地已落盘作品，并继续处理已经成功但尚未落盘的任务。
          </p>
        </div>
      </div>

      <div className="studio-toolbar">
        <input
          type="text"
          className="studio-input max-w-[320px]"
          placeholder="按提示词或文件名搜索..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className="studio-input w-[180px]"
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
        >
          <option value="newest">最新优先</option>
          <option value="oldest">最早优先</option>
        </select>
        <button
          type="button"
          className="studio-btn studio-btn-secondary !px-3 !py-2 !text-xs"
          onClick={() => void refreshOutputs()}
        >
          {refreshingOutputs ? "刷新中..." : "刷新作品"}
        </button>
      </div>

      {filteredOutputs.length === 0 ? (
        <div className="studio-empty">
          <p className="text-sm">暂无本地作品。</p>
        </div>
      ) : (
        <div className="studio-video-grid">
          {filteredOutputs.map((item) => (
            <div key={item.name} className="studio-video-card">
              <div className="studio-video-thumb">
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  controls
                  preload="metadata"
                />
              </div>
              <div className="studio-video-info space-y-3">
                <p className="line-clamp-2 text-sm font-medium text-white">
                  {item.prompt || item.name}
                </p>
                <div className="flex items-center justify-between text-xs text-[#888]">
                  <span>{new Date(item.generated_time * 1000).toLocaleDateString()}</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={item.url}
                      download={item.name}
                      className="font-medium text-[#0070f3] transition-colors hover:text-[#00e5ff]"
                    >
                      下载
                    </a>
                    <button
                      type="button"
                      className="font-medium text-[#ff7a7a] transition-colors hover:text-white"
                      onClick={() => void handleDelete(item.name)}
                      disabled={deletingOutput}
                    >
                      删除
                    </button>
                  </div>
                </div>
                {typeof item.duration_seconds === "number" && (
                  <div className="text-xs text-[#888]">耗时 {item.duration_seconds} 秒</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingFinalizeTasks.length > 0 && (
        <div className="mt-8">
          <div className="studio-section-head">
            <div>
              <h4 className="studio-section-title">待落盘任务</h4>
              <p className="studio-section-desc">
                这些任务已经成功完成，但还没有写入本地作品库。
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {pendingFinalizeTasks.map((task) => (
              <div key={task.id} className="studio-card flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">{task.prompt || task.id}</div>
                  <div className="mt-1 text-xs text-[#888]">
                    {new Date(task.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="studio-btn studio-btn-secondary !px-3 !py-2 !text-xs"
                  onClick={() => void handleFinalize(task.id, task.prompt)}
                  disabled={finalizingTaskId === task.id}
                >
                  {finalizingTaskId === task.id ? "落盘中..." : "落盘到作品库"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
