"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

type AgentType = "topic" | "writing" | "publish";
type AgentModel = "gemini-3-pro" | "gemini-2.5-pro" | "gemini-2.5-flash";

type RunListItem = {
  id: string;
  goal: string;
  agent_type: AgentType;
  status: string;
  model?: string;
  created_at: string;
  updated_at: string;
};

type ArtifactItem = {
  id: number;
  kind: "title" | "content" | "tags" | "seo" | "cover_prompt";
  content: string;
  created_at: string;
};

type RunDetail = {
  run: RunListItem;
  artifacts: ArtifactItem[];
};

type LiveArtifact = {
  kind: string;
  content: string;
};

const AGENT_DRAFT_KEY = "agent_publish_draft_v1";

function typeLabel(kind: AgentType) {
  if (kind === "topic") return "选题";
  if (kind === "publish") return "发布";
  return "写作";
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
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

function statusTone(status?: string) {
  if (status === "running") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (status === "done") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "failed") return "border-red-500/40 bg-red-500/10 text-red-200";
  return "border-zinc-700 bg-zinc-900 text-zinc-200";
}

export function AgentWorkspace() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState("");
  const [error, setError] = useState("");
  const [pinging, setPinging] = useState(false);
  const [pingInfo, setPingInfo] = useState("");

  const [goal, setGoal] = useState("");
  const [agentType, setAgentType] = useState<AgentType>("writing");
  const [agentModel, setAgentModel] = useState<AgentModel>("gemini-3-pro");
  const [instruction, setInstruction] = useState("");

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>("");
  const [detail, setDetail] = useState<RunDetail | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("idle");
  const [streamUpdatedAt, setStreamUpdatedAt] = useState("");
  const [liveArtifacts, setLiveArtifacts] = useState<LiveArtifact[]>([]);
  const [streamText, setStreamText] = useState("");

  const authHeaders = useMemo(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const loadRuns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agent/runs?page=1&size=20", { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      const items = (data?.data?.items || []) as RunListItem[];
      setRuns(items);
      if (!activeRunId && items[0]?.id) {
        setActiveRunId(items[0].id);
      }
    } catch {
      setError("加载任务列表失败");
    } finally {
      setLoading(false);
    }
  }, [activeRunId, authHeaders, token]);

  const loadDetail = useCallback(
    async (runId: string) => {
      if (!token || !runId) return;
      try {
        const res = await fetch(`/api/agent/runs/${runId}`, { headers: authHeaders });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          setError(data?.error?.message || "加载任务详情失败");
          return;
        }
        setDetail(data.data as RunDetail);
      } catch {
        setError("加载任务详情失败");
      }
    },
    [authHeaders, token]
  );

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!activeRunId || isStreaming) return;
    void loadDetail(activeRunId);
  }, [activeRunId, loadDetail, isStreaming]);

  useEffect(() => {
    const currentModel = detail?.run?.model as AgentModel | undefined;
    if (
      currentModel === "gemini-3-pro" ||
      currentModel === "gemini-2.5-pro" ||
      currentModel === "gemini-2.5-flash"
    ) {
      setAgentModel(currentModel);
    }
  }, [detail?.run?.model]);

  function upsertLiveArtifact(next: LiveArtifact) {
    setLiveArtifacts((prev) => {
      const idx = prev.findIndex((a) => a.kind === next.kind);
      if (idx < 0) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }

  async function createRun() {
    if (!goal.trim()) {
      setError("请先输入目标");
      return;
    }

    setError("");
    setCreating(true);
    setIsStreaming(true);
    setStreamStatus("running");
    setStreamUpdatedAt(new Date().toISOString());
    setLiveArtifacts([]);
    setStreamText("");

    try {
      const res = await fetch("/api/agent/run/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          agent_type: agentType,
          model: agentModel,
          goal: goal.trim(),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || "创建任务失败");
        setStreamStatus("failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let runId = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt: any;
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }

          setStreamUpdatedAt(new Date().toISOString());

          if (evt.type === "run_created") {
            runId = String(evt.run_id || "");
            if (runId) setActiveRunId(runId);
          }

          if (evt.type === "delta") {
            setStreamText((prev) => `${prev}${String(evt.text || "")}`.slice(-2000));
          }

          if (evt.type === "artifact") {
            upsertLiveArtifact({ kind: String(evt.kind || "artifact"), content: String(evt.content || "") });
          }

          if (evt.type === "error") {
            const msg = String(evt.message || "生成失败");
            const code = evt.code ? String(evt.code) : "";
            setError(code ? `[${code}] ${msg}` : msg);
            setStreamStatus("failed");
          }

          if (evt.type === "done") {
            setStreamStatus("done");
            const doneRunId = String(evt.run_id || runId || "");
            if (doneRunId) {
              setActiveRunId(doneRunId);
              await loadDetail(doneRunId);
            }
          }
        }
      }

      setGoal("");
      await loadRuns();
    } finally {
      setCreating(false);
      setIsStreaming(false);
    }
  }

  async function continueRun() {
    if (!activeRunId || !instruction.trim()) {
      setError("请先输入补充指令");
      return;
    }
    setContinuing(true);
    setError("");
    try {
      const res = await fetch(`/api/agent/runs/${activeRunId}/continue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ instruction: instruction.trim(), model: agentModel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "继续优化失败");
        return;
      }
      setInstruction("");
      await loadRuns();
      await loadDetail(activeRunId);
    } finally {
      setContinuing(false);
    }
  }

  async function exportToPublish() {
    if (!activeRunId) return;
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/agent/runs/${activeRunId}/export-to-publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "导出失败");
        return;
      }
      const payload = data?.data || {};
      localStorage.setItem(
        AGENT_DRAFT_KEY,
        JSON.stringify({
          title: payload.title || "",
          content: payload.content || "",
          tags: payload.tags || "",
          run_id: payload.run_id || "",
          ts: Date.now(),
        })
      );
      router.push(payload.redirect || "/publish?from_agent=1");
    } finally {
      setExporting(false);
    }
  }

  async function removeRun(runId: string) {
    if (!runId) return;
    setError("");
    setDeletingRunId(runId);
    try {
      const res = await fetch(`/api/agent/runs/${runId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "删除任务失败");
        return;
      }

      const nextRuns = runs.filter((item) => item.id !== runId);
      setRuns(nextRuns);
      if (activeRunId === runId) {
        const nextId = nextRuns[0]?.id || "";
        setActiveRunId(nextId);
        setDetail(null);
      }
    } catch {
      setError("删除任务失败");
    } finally {
      setDeletingRunId("");
    }
  }

  async function pingProvider() {
    setPinging(true);
    setPingInfo("");
    setError("");
    try {
      const res = await fetch("/api/agent/ping", { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setPingInfo("诊断失败：接口不可用");
        return;
      }
      const payload = data.data || {};
      if (payload.ok) {
        setPingInfo(
          `连接正常 · ${payload.provider_status} · ${payload.latency_ms}ms · ${payload.endpoint}`
        );
      } else {
        setPingInfo(
          `连接异常 · ${payload.error_code || payload.reason || "UNKNOWN"} · ${payload.message || "请求失败"}`
        );
      }
    } catch {
      setPingInfo("诊断失败：网络异常");
    } finally {
      setPinging(false);
    }
  }

  const summaryStatus = isStreaming ? streamStatus : detail?.run?.status || "--";
  const summaryUpdatedAt = isStreaming ? streamUpdatedAt : detail?.run?.updated_at || "";
  const summaryArtifactCount = isStreaming ? liveArtifacts.length : detail?.artifacts?.length || 0;
  const artifactSource = isStreaming
    ? liveArtifacts.map((a, idx) => ({ id: idx + 1, kind: a.kind, content: a.content }))
    : (detail?.artifacts || []);
  const articleArtifact = [...artifactSource].find((item: any) => item.kind === "content");

  if (!token) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/50 shadow-inner">
          <svg className="h-8 w-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="mb-2 text-xl font-semibold text-zinc-200">需要登录</h3>
        <p className="max-w-xs text-sm text-zinc-500">请先登录账号，解锁 AI 创作代理的全部功能。</p>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-[720px] grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr_1fr]">
      {/* 任务列表区域 */}
      <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#0e0e11] shadow-xl shadow-black/20">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/30 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 shadow-sm ring-1 ring-inset ring-indigo-500/20">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">任务列表</h3>
              <p className="text-[11px] text-zinc-500 font-medium">{runs.length} 个任务</p>
            </div>
          </div>
        </div>

        {/* 任务列表内容 */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500 mb-3" />
              <p className="text-xs">加载数据中...</p>
            </div>
          )}

          {!loading && runs.length === 0 && (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 px-4 py-8 text-center">
              <div className="mb-3 rounded-full bg-zinc-800/50 p-3 text-zinc-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400">暂无任务</p>
              <p className="mt-1 text-xs text-zinc-600">在右侧创建一个新任务</p>
            </div>
          )}

          <div className="space-y-2">
            {runs.map((run) => (
              <div
                key={run.id}
                className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200 ${activeRunId === run.id
                  ? "border-indigo-500/30 bg-indigo-500/5 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                  : "border-transparent bg-zinc-900/30 hover:border-zinc-800 hover:bg-zinc-800/50"
                  }`}
                onClick={() => setActiveRunId(run.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${run.status === "done" ? "bg-emerald-500" :
                    run.status === "failed" ? "bg-red-500" :
                      run.status === "running" ? "bg-amber-500 animate-pulse" :
                        "bg-zinc-600"
                    }`} />
                  <div className="min-w-0 flex-1">
                    <h4 className={`mb-1.5 line-clamp-2 text-sm font-medium leading-relaxed ${activeRunId === run.id ? "text-indigo-100" : "text-zinc-300 group-hover:text-zinc-200"}`}>
                      {run.goal || "无标题任务"}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-700/50">
                        {typeLabel(run.agent_type)}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {formatDateTime(run.updated_at).split(' ')[0]}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeRun(run.id);
                    }}
                    disabled={deletingRunId === run.id}
                    className="absolute right-2 top-2 rounded-lg p-1.5 text-zinc-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  >
                    {deletingRunId === run.id ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 创作代理区域 */}
      <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#0e0e11] shadow-xl shadow-black/20">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/30 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 shadow-sm ring-1 ring-inset ring-blue-500/20">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">创作代理</h3>
              <p className="text-[11px] text-zinc-500 font-medium">AI 智能助手</p>
            </div>
          </div>
          <button
            type="button"
            className="group flex items-center gap-2 rounded-lg bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            onClick={pingProvider}
            disabled={pinging}
          >
            <span className={`h-2 w-2 rounded-full ${pinging ? "bg-amber-400 animate-pulse" : "bg-zinc-500 group-hover:bg-blue-400"}`} />
            {pinging ? "诊断中..." : "服务状态"}
          </button>
        </div>

        {pingInfo && (
          <div className="border-b border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-2">
            <p className="text-[10px] text-zinc-400 font-mono tracking-wide">{pingInfo}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
          {/* 状态概览 */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
              <div className="mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">执行状态</div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${summaryStatus === "done" ? "text-emerald-400" :
                  summaryStatus === "failed" ? "text-red-400" :
                    summaryStatus === "running" ? "text-amber-400" :
                      "text-zinc-400"
                  }`}>
                  {summaryStatus === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                  {statusLabel(summaryStatus)}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
              <div className="mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">最后更新</div>
              <div className="text-sm font-bold text-zinc-200">{formatDateTime(summaryUpdatedAt).split(" ")[1] || "--:--"}</div>
            </div>
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
              <div className="mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">产物数量</div>
              <div className="text-sm font-bold text-zinc-200">{summaryArtifactCount}</div>
            </div>
          </div>

          {/* 表单与操作 */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">Agent 类型</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-3 py-2.5 text-sm font-medium text-zinc-200 outline-none transition-all hover:border-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 focus:ring-4 focus:ring-blue-500/10"
                    value={agentType}
                    onChange={(e) => setAgentType(e.target.value as AgentType)}
                  >
                    <option value="topic">选题助手</option>
                    <option value="writing">写作助手</option>
                    <option value="publish">发布助手</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">模型选择</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-3 py-2.5 text-sm font-medium text-zinc-200 outline-none transition-all hover:border-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 focus:ring-4 focus:ring-blue-500/10"
                    value={agentModel}
                    onChange={(e) => setAgentModel(e.target.value as AgentModel)}
                  >
                    <option value="gemini-3-pro">Gemini 3 Pro</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">创作目标</label>
              <textarea
                className="min-h-[140px] w-full resize-none rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-4 py-3 text-sm leading-relaxed text-zinc-200 placeholder-zinc-500 outline-none transition-all hover:border-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900 focus:ring-4 focus:ring-blue-500/10 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700"
                placeholder="在此输入您的创作目标..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 transition-all hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={createRun}
              disabled={creating}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-700/0 via-white/10 to-blue-700/0 opacity-0 transition-opacity group-hover:opacity-100" />
              {creating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span className="text-sm font-semibold text-white">正在创建...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  <span className="text-sm font-bold text-white tracking-wide">创建新任务</span>
                </>
              )}
            </button>
          </div>

          {/* 分隔 */}
          <div className="my-8 flex items-center gap-4 px-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-tight">后续操作</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* 优化区域 */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">优化指令</label>
              <textarea
                className="min-h-[80px] w-full resize-none rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-4 py-3 text-sm leading-relaxed text-zinc-200 placeholder-zinc-500 outline-none transition-all hover:border-zinc-600 focus:border-indigo-500/50 focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700"
                placeholder="输入优化建议，如：增加更多数据支持..."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={continueRun}
                disabled={continuing || !activeRunId}
              >
                {continuing ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400/30 border-t-zinc-300" />
                ) : (
                  <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
                {continuing ? "优化中" : "继续优化"}
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 py-2.5 text-sm font-semibold text-indigo-300 transition-all hover:bg-indigo-500/20 hover:border-indigo-500/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={exportToPublish}
                disabled={exporting || !activeRunId}
              >
                {exporting ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                )}
                {exporting ? "导出中" : "导出结果"}
              </button>
            </div>
          </div>

          {/* 实时流日志 */}
          {isStreaming && streamText && (
            <div className="mt-6 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2 border-b border-amber-500/10 bg-amber-500/5 px-3 py-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Processing Stream</span>
              </div>
              <div className="max-h-32 overflow-y-auto px-4 py-3">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-200/90">{streamText}</pre>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-xs font-medium text-red-300">{error}</p>
            </div>
          )}
        </div>
      </section>

      {/* 文章输出区域 */}
      <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#0e0e11] shadow-xl shadow-black/20 lg:col-span-2 xl:col-span-1">
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/30 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 shadow-sm ring-1 ring-inset ring-emerald-500/20">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">内容预览</h3>
              <p className="text-[11px] text-zinc-500 font-medium">生成结果</p>
            </div>
          </div>
        </div>

        {/* 文章内容 */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
          {articleArtifact ? (
            <div className="min-h-full rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-8 shadow-inner">
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-[15px] leading-8 text-zinc-300">
                  {articleArtifact.content}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10">
              <div className="group mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 transition-all hover:bg-zinc-800 ring-1 ring-inset ring-zinc-800">
                <svg className="h-8 w-8 text-zinc-600 transition-colors group-hover:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400">暂无内容</p>
              <p className="mt-1 max-w-[200px] text-center text-xs text-zinc-600">在中间栏创建任务，AI 生成的内容将显示在这里</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
