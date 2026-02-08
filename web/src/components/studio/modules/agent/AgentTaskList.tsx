"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";

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
  const { token } = useAuth();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadRuns = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch("/api/agent/runs?page=1&size=50", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      const items = (data?.data?.items || []) as RunListItem[];
      setRuns(items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  async function removeRun(runId: string) {
    if (!runId || !token) return;
    setDeletingId(runId);
    try {
      await fetch(`/api/agent/runs/${runId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setRuns(prev => prev.filter(r => r.id !== runId));
    } finally {
      setDeletingId("");
    }
  }

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch { }
  };

  if (loading && runs.length === 0) {
    return <div className="py-16 text-center text-sm text-[#888]">正在加载任务...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="studio-section-head">
        <div>
          <h3 className="studio-section-title">任务列表</h3>
          <p className="studio-section-desc">所有历史创作任务。</p>
        </div>
        <button
          onClick={() => loadRuns()}
          disabled={refreshing}
          className="studio-btn studio-btn-secondary !py-1.5 !px-3 !text-xs"
        >
          {refreshing ? "刷新中..." : "刷新列表"}
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="studio-empty">暂无任务</div>
      ) : (
        <div className="space-y-4 pb-8">
          {runs.map(run => (
            <div key={run.id} className="studio-card flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-white truncate text-sm">{run.goal || "无标题任务"}</h4>
                  <span className={`studio-badge ${run.status === "done" ? "studio-badge-success" :
                      run.status === "running" ? "studio-badge-warning" : "studio-badge-info"
                    }`}>
                    {statusLabel(run.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                    {typeLabel(run.agent_type)}
                  </span>
                  <span>ID: {run.id} <button onClick={() => copyId(run.id)} className="ml-1 text-blue-400 hover:text-blue-300">复制</button></span>
                  <span>{formatDateTime(run.created_at)}</span>
                </div>
              </div>

              <button
                onClick={() => removeRun(run.id)}
                disabled={deletingId === run.id}
                className="studio-btn studio-btn-secondary !text-red-400 hover:!bg-red-500/10 !border-red-900/30 !py-2 !px-3 !text-xs whitespace-nowrap"
              >
                {deletingId === run.id ? "删除中..." : "删除任务"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
