"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get, getPaginated } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import { useVideoOutputs } from "./hooks/useVideoOutputs";

interface Task {
  id: string;
  status: string;
  progress: number;
  prompt: string;
  created_at: string;
  error?: string;
  failure_reason?: string;
  results?: Array<{ url: string }>;
}

const statusLabels: Record<string, string> = {
  succeeded: "已完成",
  failed: "失败",
  running: "进行中",
  pending: "排队中",
};

export function TaskList() {
  const { isAuthenticated } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [finalizingTaskId, setFinalizingTaskId] = useState<string | null>(null);
  const { finalizeOutput } = useVideoOutputs(isAuthenticated);

  const tasksQuery = useQuery({
    queryKey: queryKeys.videoTasks({ limit: 30 }),
    queryFn: async () => {
      const list = await getPaginated<Task>(
        getVersionedApiPath("/video/tasks"),
        { page: 1, limit: 30 }
      );

      const active = list.items.filter(
        (task) => task.status === "pending" || task.status === "running"
      );

      const updatedActive = await Promise.all(
        active.map(async (task) => {
          try {
            return await get<Task>(getVersionedApiPath(`/video/tasks/${task.id}`));
          } catch {
            return task;
          }
        })
      );

      const activeMap = new Map(updatedActive.map((task) => [task.id, task]));
      return list.items.map((task) => activeMap.get(task.id) || task);
    },
    enabled: isAuthenticated,
    refetchInterval: autoRefresh ? 5000 : false,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });

  const tasks = tasksQuery.data || [];
  const lastUpdated = tasksQuery.dataUpdatedAt
    ? new Date(tasksQuery.dataUpdatedAt)
    : null;

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
    } catch {}
  }

  async function handleFinalize(task: Task) {
    setActionStatus((prev) => ({ ...prev, [task.id]: "" }));
    setFinalizingTaskId(task.id);

    try {
      const result = await finalizeOutput({ id: task.id, prompt: task.prompt || "" });
      const hasFile = Boolean(
        result &&
          typeof result === "object" &&
          "file" in result &&
          typeof (result as { file?: string }).file === "string"
      );

      setActionStatus((prev) => ({
        ...prev,
        [task.id]: hasFile ? "已落盘到作品库。" : "任务尚未生成可落盘结果。",
      }));
    } catch (error) {
      setActionStatus((prev) => ({
        ...prev,
        [task.id]: error instanceof Error ? error.message : "落盘失败，请稍后重试。",
      }));
    } finally {
      setFinalizingTaskId(null);
    }
  }

  if (tasksQuery.isLoading) {
    return <div className="py-16 text-center text-sm text-[#888]">正在加载任务...</div>;
  }

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">任务列表</h3>
          <p className="studio-section-desc">
            查看最近任务状态，并把已完成任务落盘到作品库。
          </p>
        </div>
      </div>

      <div className="studio-toolbar justify-between">
        <div className="text-xs text-[#888]">
          当前任务：<span className="text-white">{tasks.length}</span>
          {lastUpdated && (
            <span className="ml-3">更新时间：{lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`studio-btn studio-btn-secondary !px-3 !py-2 !text-xs ${
              autoRefresh ? "active" : ""
            }`}
            onClick={() => setAutoRefresh((value) => !value)}
          >
            自动刷新：{autoRefresh ? "开" : "关"}
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-secondary !px-3 !py-2 !text-xs"
            onClick={() => void tasksQuery.refetch()}
            disabled={tasksQuery.isFetching}
          >
            {tasksQuery.isFetching ? "刷新中..." : "立即刷新"}
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="studio-empty">
          <p className="text-sm">暂无任务记录。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="studio-card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="line-clamp-1 flex-1 text-sm font-semibold text-white">
                  {task.prompt || "未命名任务"}
                </h4>
                <span className="studio-badge studio-badge-info">
                  {statusLabels[task.status] || "处理中"}
                </span>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[#888]">
                <span>ID：{task.id}</span>
                <button
                  type="button"
                  className="text-[#8fb8ff] hover:text-white"
                  onClick={() => void copyId(task.id)}
                >
                  复制 ID
                </button>
                <span>{new Date(task.created_at).toLocaleString()}</span>
              </div>

              <div className="mb-2 flex items-center justify-between text-xs text-[#888]">
                <span>任务进度</span>
                <span className="font-medium text-white">{task.progress}%</span>
              </div>
              <div className="studio-progress">
                <div
                  className="studio-progress-bar"
                  style={{ width: `${task.progress}%` }}
                />
              </div>

              {task.status === "succeeded" && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary !px-3 !py-2 !text-xs"
                    onClick={() => void handleFinalize(task)}
                    disabled={finalizingTaskId === task.id}
                  >
                    {finalizingTaskId === task.id ? "落盘中..." : "落盘到作品库"}
                  </button>
                  {actionStatus[task.id] && (
                    <span className="text-xs text-[#8fb8ff]">{actionStatus[task.id]}</span>
                  )}
                </div>
              )}

              {(task.error || task.failure_reason) && (
                <div className="studio-status studio-status-error mt-4">
                  <div className="studio-status-dot" />
                  {task.error || task.failure_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
