"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { del, get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";

type AgentType = "topic" | "writing" | "publish";

type RunListItem = {
  id: string;
  goal: string;
  agent_type: AgentType;
  status: string;
  model?: string;
  created_at: string;
  updated_at: string;
};

function typeLabel(kind: AgentType) {
  if (kind === "topic") return "💡 选题";
  if (kind === "publish") return "🚀 发布";
  return "✍️ 写作";
}

function statusLabel(status?: string) {
  switch (status) {
    case "running": return "进行中";
    case "done": return "已完成";
    case "failed": return "失败";
    case "queued": return "排队中";
    default: return status || "--";
  }
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function AgentTaskList() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const runsQuery = useQuery({
    queryKey: ["agent-runs"],
    queryFn: async () => {
      const result = await get<{ items: RunListItem[] }>(
        `${getVersionedApiPath("/agent/runs")}?page=1&size=50`
      );
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const deleteRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      await del(getVersionedApiPath(`/agent/runs/${runId}`));
      return runId;
    },
    onSuccess: async (runId) => {
      queryClient.setQueryData<RunListItem[]>(["agent-runs"], (current) =>
        Array.isArray(current) ? current.filter((item) => item.id !== runId) : current
      );
      queryClient.removeQueries({ queryKey: ["agent-run-detail", runId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-gallery"] }),
      ]);
    },
  });

  const runs = runsQuery.data || [];

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // ignore
    }
  };

  if (runsQuery.isLoading && runs.length === 0) {
    return <div className="py-16 text-center text-sm text-zinc-500">正在加载任务列表...</div>;
  }

  return (
    <div className="agent-list-page p-6 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">历史 Agent 任务列表 (旧版接口)</h3>
          <p className="text-zinc-400 text-sm">此页面的废弃旧版工作台记录，保留用于查看过去通过大表单生成的草稿。</p>
        </div>
        <button
          onClick={() => void runsQuery.refetch()}
          disabled={runsQuery.isFetching}
          className="studio-btn studio-btn-secondary"
        >
          {runsQuery.isFetching ? "刷新中..." : "刷新"}
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="studio-empty bg-white/5 border border-white/5 p-12 text-center rounded-xl">暂无任务</div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <article key={run.id} className="relative bg-[#1e293b] border border-white/5 rounded-xl pt-5 pr-14 pb-5 pl-5 hover:border-blue-500/30 transition-all">
              <div className="agent-task-main">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2 h-2 rounded-full ${run.status === "done" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : run.status === "running" ? "bg-blue-500 animate-pulse" : run.status === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                  <h4 className="text-[15px] font-semibold text-[#f2f5fe] truncate max-w-[80%]" title={run.goal}>
                    {run.goal || "未命名任务"}
                  </h4>
                  <span className="text-xs text-zinc-500 ml-auto bg-black/20 px-2 py-0.5 rounded">{statusLabel(run.status)}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#8896b0] mt-3">
                  <span className="flex items-center gap-1 bg-[#0f1219] border border-[#7891be]/20 px-2.5 py-1 rounded-md text-[#a5c6f7]">
                    {typeLabel(run.agent_type)}
                  </span>
                  <span>模型: {run.model || "默认模型"}</span>
                  <span>{formatDateTime(run.created_at)}</span>
                </div>
                <div
                  className="font-mono text-[10px] text-[#4d5b7a] mt-2 hover:text-[#3882f6] cursor-pointer transition-colors w-fit bg-black/20 px-1 py-0.5 rounded"
                  onClick={() => void copyId(run.id)}
                  title="点击复制任务 ID"
                >
                  ID: {run.id}
                </div>
              </div>
              <button
                onClick={() => deleteRunMutation.mutate(run.id)}
                disabled={deleteRunMutation.isPending && deleteRunMutation.variables === run.id}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 text-[#6b7fa0] hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-xl transition-all"
                title="删除任务"
              >
                {deleteRunMutation.isPending && deleteRunMutation.variables === run.id ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                )}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
