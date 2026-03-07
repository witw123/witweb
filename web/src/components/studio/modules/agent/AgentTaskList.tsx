"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { del, get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

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
  if (kind === "topic") return "选题";
  if (kind === "publish") return "发布";
  return "写作";
}

function statusLabel(status?: string) {
  switch (status) {
    case "running":
      return "进行中";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    case "queued":
      return "排队中";
    default:
      return status || "--";
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
    queryKey: queryKeys.agentRuns,
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
      queryClient.setQueryData<RunListItem[]>(queryKeys.agentRuns, (current) =>
        Array.isArray(current) ? current.filter((item) => item.id !== runId) : current
      );
      queryClient.removeQueries({ queryKey: queryKeys.agentRunDetail(runId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agentGallery }),
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
    <div className="agent-list-page">
      <div className="studio-section-head">
        <div>
          <h3 className="agent-panel-title">任务列表</h3>
          <p className="agent-panel-desc">查看历史生成任务并管理记录。</p>
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
        <div className="studio-empty">暂无任务</div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <article key={run.id} className="agent-task-card">
              <div className="agent-task-main">
                <div className="agent-task-top">
                  <h4>{run.goal || "未命名任务"}</h4>
                  <span
                    className={`studio-badge ${
                      run.status === "done"
                        ? "studio-badge-success"
                        : run.status === "running"
                          ? "studio-badge-warning"
                          : "studio-badge-error"
                    }`}
                  >
                    {statusLabel(run.status)}
                  </span>
                </div>
                <div className="agent-task-meta">
                  <span>类型: {typeLabel(run.agent_type)}</span>
                  <span>模型: {run.model || "--"}</span>
                  <span>创建于: {formatDateTime(run.created_at)}</span>
                </div>
                <div className="agent-task-id">
                  ID: {run.id}
                  <button type="button" onClick={() => void copyId(run.id)}>
                    复制
                  </button>
                </div>
              </div>
              <button
                onClick={() => deleteRunMutation.mutate(run.id)}
                disabled={
                  deleteRunMutation.isPending &&
                  deleteRunMutation.variables === run.id
                }
                className="studio-btn studio-btn-secondary"
              >
                {deleteRunMutation.isPending &&
                deleteRunMutation.variables === run.id
                  ? "删除中..."
                  : "删除"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
