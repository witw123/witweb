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
      <div className="rounded-2xl border border-zinc-800 bg-[#0b0d12] p-8 text-zinc-300">
        请先登录后使用 AI 创作代理。
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-[620px] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-zinc-800 bg-[#0b0d12] p-6 xl:col-span-1">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300">任务列表</h3>
        <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
          {loading && <p className="text-sm text-zinc-500">加载中...</p>}
          {!loading && runs.length === 0 && <p className="text-sm text-zinc-500">暂无任务</p>}
          {runs.map((run) => (
            <div
              key={run.id}
              className={`rounded-xl border transition ${
                activeRunId === run.id
                  ? "border-blue-500/60 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setActiveRunId(run.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="line-clamp-2 text-base font-medium leading-7 text-zinc-100">{run.goal}</div>
                  <div className="mt-1.5 text-sm text-zinc-400">
                    {typeLabel(run.agent_type)} · {statusLabel(run.status)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void removeRun(run.id)}
                  disabled={deletingRunId === run.id}
                  className="h-8 shrink-0 rounded-lg border border-zinc-700 px-2.5 text-xs text-zinc-300 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
                >
                  {deletingRunId === run.id ? "删除中" : "删除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-[#0b0d12] p-6 xl:col-span-1">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300">创作代理</h3>

        <div className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 md:grid-cols-3">
          <div className="rounded-lg bg-zinc-950/60 px-3 py-2.5">
            <div className="text-[11px] text-zinc-500">状态</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(summaryStatus)}`}
              >
                {statusLabel(summaryStatus)}
              </span>
              {isStreaming ? <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" /> : null}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-950/60 px-3 py-2.5">
            <div className="text-[11px] text-zinc-500">更新时间</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{formatDateTime(summaryUpdatedAt)}</div>
          </div>
          <div className="rounded-lg bg-zinc-950/60 px-3 py-2.5">
            <div className="text-[11px] text-zinc-500">产物数量</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{summaryArtifactCount}</div>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
            onClick={pingProvider}
            disabled={pinging}
          >
            {pinging ? "诊断中..." : "连接诊断"}
          </button>
          {pingInfo ? <p className="text-xs text-zinc-400">{pingInfo}</p> : null}
        </div>

        <div className="grid gap-4 border-b border-zinc-800 pb-6">
          <label className="text-xs text-zinc-400">
            Agent 类型
            <select
              className="mt-2 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-base text-zinc-100"
              value={agentType}
              onChange={(e) => setAgentType(e.target.value as AgentType)}
            >
              <option value="topic">选题助手</option>
              <option value="writing">写作助手</option>
              <option value="publish">发布助手</option>
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            模型
            <select
              className="mt-2 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-base text-zinc-100"
              value={agentModel}
              onChange={(e) => setAgentModel(e.target.value as AgentModel)}
            >
              <option value="gemini-3-pro">gemini-3-pro</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            目标
            <textarea
              className="mt-2 min-h-[132px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-3 text-base leading-7 text-zinc-100"
              placeholder="例如：写一篇针对建筑设计师的 AI 草图转 CAD 指南"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="h-11 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            onClick={createRun}
            disabled={creating}
          >
            {creating ? "生成中..." : "创建任务"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-6">
          <textarea
            className="min-h-[112px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-3 text-base leading-7 text-zinc-100"
            placeholder="继续优化指令，例如：把语气改成更专业，增加实操案例"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              className="h-10 rounded-xl border border-zinc-700 px-3.5 text-base text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
              onClick={continueRun}
              disabled={continuing || !activeRunId}
            >
              {continuing ? "优化中..." : "继续优化"}
            </button>
            <button
              type="button"
              className="h-10 rounded-xl border border-blue-500/60 bg-blue-500/10 px-3.5 text-base text-blue-200 transition hover:bg-blue-500/15 disabled:opacity-50"
              onClick={exportToPublish}
              disabled={exporting || !activeRunId}
            >
              {exporting ? "导出中..." : "导出到发布页"}
            </button>
          </div>
        </div>

        {isStreaming && streamText && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-400">实时生成流</div>
            <div className="max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
              {streamText}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-[#0b0d12] p-6 xl:col-span-2 2xl:col-span-1">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300">文章输出</h3>
        <div className="max-h-[68vh] overflow-y-auto pr-1">
          {articleArtifact ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-300">正文</div>
              <div className="max-h-[62vh] overflow-y-auto whitespace-pre-wrap text-base leading-8 text-zinc-200">
                {articleArtifact.content}
              </div>
            </div>
          ) : (
            <p className="text-base text-zinc-500">暂无文章输出</p>
          )}
        </div>
      </section>
    </div>
  );
}
