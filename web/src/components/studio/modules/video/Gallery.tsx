"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const fetchTasks = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch("/api/video/tasks?limit=100", {
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

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const list = q ? tasks.filter((t) => (t.prompt || "").toLowerCase().includes(q)) : tasks;
    return [...list].sort((a, b) => {
      const av = new Date(a.created_at).getTime();
      const bv = new Date(b.created_at).getTime();
      return sort === "newest" ? bv - av : av - bv;
    });
  }, [tasks, keyword, sort]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#888]">正在加载作品...</div>;
  }

  return (
    <section className="studio-subpage">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">作品库</h3>
          <p className="studio-section-desc">查看所有已完成的视频作品，可按关键词筛选。</p>
        </div>
      </div>

      <div className="studio-toolbar">
        <input
          type="text"
          className="studio-input max-w-[320px]"
          placeholder="按提示词搜索..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select className="studio-input w-[180px]" value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")}>
          <option value="newest">最新优先</option>
          <option value="oldest">最早优先</option>
        </select>
        <button type="button" className="studio-btn studio-btn-secondary !px-3 !py-2 !text-xs" onClick={fetchTasks}>
          刷新作品
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="studio-empty">
          <p className="text-sm">暂无已完成作品。</p>
        </div>
      ) : (
        <div className="studio-video-grid">
          {filtered.map((task) => (
            <div key={task.id} className="studio-video-card">
              <div className="studio-video-thumb">
                {task.results?.[0] ? (
                  <video src={task.results[0].url} className="h-full w-full object-cover" controls preload="metadata" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[#666]">无视频数据</div>
                )}
              </div>
              <div className="studio-video-info space-y-3">
                <p className="line-clamp-2 text-sm font-medium text-white">{task.prompt || "未命名作品"}</p>
                <div className="flex items-center justify-between text-xs text-[#888]">
                  <span>{new Date(task.created_at).toLocaleDateString()}</span>
                  {task.results?.[0] && (
                    <a href={task.results[0].url} download className="font-medium text-[#0070f3] transition-colors hover:text-[#00e5ff]">
                      下载
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
