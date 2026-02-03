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

export function TaskList() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/video/tasks", {
        headers: { Authorization: `Bearer ${token}` }
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

  // Individual task polling for progress updates
  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status === "running" || t.status === "pending");
    if (activeTasks.length === 0) return;

    const pollers = activeTasks.map(task => {
      return setInterval(async () => {
        try {
          const res = await fetch(`/api/video/tasks/${task.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const updated = await res.json();
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        } catch { }
      }, 3000);
    });

    return () => pollers.forEach(p => clearInterval(p));
  }, [tasks.length, token]);

  if (loading) return <div className="p-10 text-center text-zinc-500">加载中...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-[#444444] bg-[#0a0a0a]/20 rounded-[3rem] border border-dashed border-[#111111]">
          <svg className="w-20 h-20 mb-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="font-heading font-black tracking-[0.2em] text-sm">暂无进行中的任务</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {tasks.map((task: any) => (
            <div key={task.id} className="bg-[#111111]/40 border border-[#333333] rounded-[2.5rem] p-10 transition-all hover:bg-[#111111]/60 relative overflow-hidden group hover:border-[#444444] shadow-lg">
              <div className="absolute top-0 right-0 p-8">
                <span className={`text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest border ${task.status === 'succeeded' ? 'bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/20' :
                  task.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-[#0070f3]/10 text-[#0070f3] border-[#0070f3]/20'
                  }`}>
                  {task.status === 'succeeded' ? '已完成' : task.status === 'failed' ? '失败' : '生成中'}
                </span>
              </div>

              <div className="mb-10 pr-24">
                <h3 className="text-[#ededed] font-bold text-lg mb-4 line-clamp-1 leading-relaxed">
                  {task.prompt || "未命名任务"}
                </h3>
                <div className="flex items-center gap-6 text-[11px] text-[#555555] font-mono tracking-wider">
                  <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" /> ID: {task.id.slice(0, 8)}...</span>
                  <span>•</span>
                  <span>创建时间: {new Date(task.created_at).toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[11px] font-black text-[#a1a1a1] tracking-[0.1em]">生成进度</span>
                  <span className="text-sm font-mono font-bold text-[#0070f3]">{task.progress}%</span>
                </div>
                <div className="h-2 w-full bg-[#050505] rounded-full overflow-hidden border border-[#111111]">
                  <div
                    className="h-full bg-[#0070f3] rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_20px_rgba(0,112,243,0.5)]"
                    style={{ width: `${task.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                  </div>
                </div>
              </div>

              {(task.error || task.failure_reason) && (
                <div className="mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] text-xs font-bold tracking-wide text-red-400 flex items-start gap-5">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    系统异常: {task.error || (task.failure_reason === "output_moderation" ? "内容审核拦截 (输出)" : task.failure_reason === "input_moderation" ? "内容审核拦截 (输入)" : "合成引擎故障")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
