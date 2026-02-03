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
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          const completed = data.tasks.filter((t: Task) => t.status === "succeeded");
          setTasks(completed);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [token]);

  if (loading) return <div className="p-10 text-center text-zinc-500">加载中...</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 pb-12">
      {tasks.length === 0 ? (
        <div className="col-span-full py-36 text-center text-[#444444] bg-[#0a0a0a]/20 border border-dashed border-[#111111] rounded-[3rem] flex flex-col items-center justify-center">
          <svg className="w-20 h-20 mb-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-heading font-black tracking-[0.2em] text-sm">暂无生成的作品</p>
        </div>
      ) : (
        tasks.map(task => (
          <div key={task.id} className="group bg-[#050505] border border-[#111111] rounded-[2.5rem] overflow-hidden hover:border-[#333333] transition-all flex flex-col shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />

            <div className="aspect-video bg-[#0a0a0a] relative flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
              {task.results && task.results[0] ? (
                <video
                  src={task.results[0].url}
                  className="w-full h-full object-cover"
                  controls
                  preload="none"
                  poster="/video-placeholder.png"
                />
              ) : (
                <div className="text-[#333333] text-xs font-black tracking-widest">渲染数据丢失</div>
              )}
              <div className="absolute top-5 right-5 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-full text-[10px] text-white/50 font-mono border border-white/10 z-20">
                REF: {task.id.slice(0, 8)}
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col relative bg-[#0a0a0a]">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#333333] to-transparent opacity-20" />

              <div className="flex-1">
                <h4 className="text-[11px] font-black text-[#0070f3] tracking-[0.1em] mb-3 font-heading">画面描述</h4>
                <p className="text-[#ededed] text-sm line-clamp-3 leading-loose font-light opacity-80 group-hover:opacity-100 transition-opacity">
                  {task.prompt}
                </p>
              </div>

              <div className="mt-10 flex items-center justify-between border-t border-[#111111] pt-5">
                <span className="text-[10px] text-[#444444] font-mono tracking-widest">
                  {new Date(task.created_at).toLocaleDateString()}
                </span>

                <div className="flex gap-2">
                  {task.results?.[0] && (
                    <a
                      href={task.results[0].url}
                      download
                      className="p-3 bg-[#111111] hover:bg-[#0070f3] rounded-2xl text-[#a1a1a1] hover:text-white transition-all shadow-lg hover:shadow-[0_0_20px_rgba(0,112,243,0.4)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
