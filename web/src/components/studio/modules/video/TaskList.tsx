"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";

interface Task {
  id: string;
  status: string;
  progress: number;
  prompt: string;
  created_at: string;
  error?: string;
  failure_reason?: string;
}

const statusLabels: Record<string, string> = {
  succeeded: "已完成",
  failed: "失败",
  running: "进行中",
  pending: "排队中",
};

export function TaskList() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTasks = async (silent = false) => {
    if (!token) return;
    if (!silent) setRefreshing(true);

    try {
      const res = await fetch("/api/video/tasks?limit=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const all = Array.isArray(data.tasks) ? (data.tasks as Task[]) : [];
      const active = all.filter((t) => t.status === "pending" || t.status === "running");

      const updated = await Promise.all(
        active.map(async (t) => {
          try {
            const detailRes = await fetch(`/api/video/tasks/${t.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!detailRes.ok) return t;
            return (await detailRes.json()) as Task;
          } catch {
            return t;
          }
        })
      );

      setTasks(updated.filter((t) => t.status === "pending" || t.status === "running"));
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => fetchTasks(true), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, autoRefresh]);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {}
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#888]">正在加载任务...</div>;
  }

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">任务列表</h3>
          <p className="studio-section-desc">查看当前进行中的任务进度与状态。</p>
        </div>
      </div>

      <div className="studio-toolbar justify-between">
        <div className="text-xs text-[#888]">
          当前任务：<span className="text-white">{tasks.length}</span>
          {lastUpdated && <span className="ml-3">更新时间：{lastUpdated.toLocaleTimeString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`studio-btn studio-btn-secondary !px-3 !py-2 !text-xs ${autoRefresh ? "active" : ""}`}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            自动刷新：{autoRefresh ? "开" : "关"}
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-secondary !px-3 !py-2 !text-xs"
            onClick={() => fetchTasks()}
            disabled={refreshing}
          >
            {refreshing ? "刷新中..." : "立即刷新"}
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="studio-empty">
          <p className="text-sm">当前没有进行中的任务。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="studio-card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="line-clamp-1 flex-1 text-sm font-semibold text-white">{task.prompt || "未命名任务"}</h4>
                <span className="studio-badge studio-badge-info">{statusLabels[task.status] || "处理中"}</span>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[#888]">
                <span>ID：{task.id}</span>
                <button type="button" className="text-[#8fb8ff] hover:text-white" onClick={() => copyId(task.id)}>
                  复制 ID
                </button>
                <span>{new Date(task.created_at).toLocaleString()}</span>
              </div>

              <div className="mb-2 flex items-center justify-between text-xs text-[#888]">
                <span>任务进度</span>
                <span className="font-medium text-white">{task.progress}%</span>
              </div>
              <div className="studio-progress">
                <div className="studio-progress-bar" style={{ width: `${task.progress}%` }} />
              </div>

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
