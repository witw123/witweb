"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";

interface VideoResult {
  url: string;
}

interface Task {
  id: string;
  status: string;
  progress: number;
  prompt: string;
  created_at: string;
  results?: VideoResult[];
}

export function Gallery() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const fetchTasks = async () => {
      try {
        const res = await fetch("/api/video/tasks?limit=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks.filter((t: Task) => t.status === "succeeded"));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [token]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#888]">加载中...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="studio-empty">
        <p className="text-sm">暂无已完成作品</p>
      </div>
    );
  }

  return (
    <div className="studio-video-grid">
      {tasks.map((task) => (
        <div key={task.id} className="studio-video-card">
          <div className="studio-video-thumb">
            {task.results?.[0] ? (
              <video
                src={task.results[0].url}
                className="h-full w-full object-cover"
                controls
                preload="none"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[#666]">
                无视频数据
              </div>
            )}
          </div>
          <div className="studio-video-info space-y-3">
            <p className="line-clamp-2 text-sm text-white font-medium">{task.prompt}</p>
            <div className="flex items-center justify-between text-xs text-[#888]">
              <span>{new Date(task.created_at).toLocaleDateString()}</span>
              {task.results?.[0] && (
                <a
                  href={task.results[0].url}
                  download
                  className="text-[#0070f3] hover:text-[#00e5ff] transition-colors font-medium"
                >
                  下载
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

