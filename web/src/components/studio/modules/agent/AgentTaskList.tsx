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
  const { token } = useAuth();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadRuns = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const res = await fetch("/api/agent/runs?page=1&size=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        const items = (data?.data?.items || []) as RunListItem[];
        setRuns(items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

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
      setRuns((prev) => prev.filter((item) => item.id !== runId));
    } finally {
      setDeletingId("");
    }
  }

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // ignore
    }
  };

  if (loading && runs.length === 0) {
    return <div className="py-16 text-center text-sm text-zinc-500">正在加载任务列表...</div>;
  }

  return (
    <div className="agent-list-page">
      <div className="studio-section-head">
        <div>
          <h3 className="agent-panel-title">任务列表</h3>
          <p className="agent-panel-desc">查看历史生成任务并管理记录。</p>
        </div>
        <button onClick={() => loadRuns()} disabled={refreshing} className="studio-btn studio-btn-secondary">
          {refreshing ? "刷新中..." : "刷新"}
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
                  <span className={`studio-badge ${run.status === "done" ? "studio-badge-success" : run.status === "running" ? "studio-badge-warning" : "studio-badge-error"}`}>{statusLabel(run.status)}</span>
                </div>
                <div className="agent-task-meta">
                  <span>类型: {typeLabel(run.agent_type)}</span>
                  <span>模型: {run.model || "--"}</span>
                  <span>创建于: {formatDateTime(run.created_at)}</span>
                </div>
                <div className="agent-task-id">
                  ID: {run.id}
                  <button type="button" onClick={() => copyId(run.id)}>复制</button>
                </div>
              </div>
              <button
                onClick={() => removeRun(run.id)}
                disabled={deletingId === run.id}
                className="studio-btn studio-btn-secondary"
              >
                {deletingId === run.id ? "删除中..." : "删除"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
