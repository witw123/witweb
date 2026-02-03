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
  succeeded: "完成",
  failed: "失败",
  running: "运行中",
  pending: "排队中",
};

export function TaskList() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/video/tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data.tasks)) {
        const active = data.tasks.filter((t: Task) => t.status === "pending" || t.status === "running");
        setTasks(active);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#888]">加载中...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="studio-empty">
        <p className="text-sm">当前没有进行中的任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tasks.map((task) => (
        <div key={task.id} className="studio-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="line-clamp-1 text-sm font-semibold text-white flex-1">
              {task.prompt || "未命名任务"}
            </h3>
            <span className="studio-badge studio-badge-info">
              {statusLabels[task.status] || "处理中"}
            </span>
          </div>

          <div className="mb-4 text-xs text-[#666]">
            ID: {task.id.slice(0, 8)}... · {new Date(task.created_at).toLocaleString()}
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-[#888]">
            <span>进度</span>
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
  );
}

