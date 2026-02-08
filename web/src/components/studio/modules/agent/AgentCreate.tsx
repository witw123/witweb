"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";
import { readSelectedPreset, type AgentPreset } from "./agent-preset-storage";

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

interface AgentCreateProps {
  onTaskCreated?: (taskId: string) => void;
}

export function AgentCreate({ onTaskCreated }: AgentCreateProps) {
  const { token } = useAuth();

  const [creating, setCreating] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [error, setError] = useState("");
  const [pingInfo, setPingInfo] = useState("");

  const [goal, setGoal] = useState("");
  const [agentType, setAgentType] = useState<AgentType>("writing");
  const [agentModel, setAgentModel] = useState<AgentModel>("gemini-3-pro");
  const [instruction, setInstruction] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<AgentPreset | null>(null);

  const [activeRunId, setActiveRunId] = useState("");
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

  useEffect(() => {
    setSelectedPreset(readSelectedPreset());
  }, []);

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
    if (!activeRunId || isStreaming) return;
    void loadDetail(activeRunId);
  }, [activeRunId, isStreaming, loadDetail]);

  function upsertLiveArtifact(next: LiveArtifact) {
    setLiveArtifacts((prev) => {
      const idx = prev.findIndex((item) => item.kind === next.kind);
      if (idx < 0) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }

  function collectCustomPayload() {
    if (!selectedPreset?.systemPrompt?.trim()) return {};
    return {
      assistant_name: selectedPreset.assistantName.trim() || undefined,
      custom_system_prompt: selectedPreset.systemPrompt.trim() || undefined,
    };
  }

  async function createRun() {
    if (!goal.trim()) {
      setError("请先输入创作目标");
      return;
    }

    setError("");
    setCreating(true);
    setIsStreaming(true);
    setStreamStatus("running");
    setStreamUpdatedAt(new Date().toISOString());
    setLiveArtifacts([]);
    setStreamText("");
    setDetail(null);
    setActiveRunId("");

    try {
      const res = await fetch("/api/agent/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          agent_type: agentType,
          model: agentModel,
          goal: goal.trim(),
          ...collectCustomPayload(),
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
            upsertLiveArtifact({
              kind: String(evt.kind || "artifact"),
              content: String(evt.content || ""),
            });
          }
          if (evt.type === "error") {
            setError(String(evt.message || "生成失败"));
            setStreamStatus("failed");
          }
          if (evt.type === "done") {
            setStreamStatus("done");
            const doneRunId = String(evt.run_id || runId || "");
            if (doneRunId) {
              setActiveRunId(doneRunId);
              await loadDetail(doneRunId);
              onTaskCreated?.(doneRunId);
            }
          }
        }
      }

      setGoal("");
    } finally {
      setCreating(false);
      setIsStreaming(false);
    }
  }

  async function continueRun() {
    if (!activeRunId || !instruction.trim()) {
      setError("请先输入优化指令");
      return;
    }

    setContinuing(true);
    setError("");

    try {
      const res = await fetch(`/api/agent/runs/${activeRunId}/continue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          instruction: instruction.trim(),
          model: agentModel,
          ...collectCustomPayload(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "继续优化失败");
        return;
      }
      setInstruction("");
      await loadDetail(activeRunId);
    } finally {
      setContinuing(false);
    }
  }

  async function exportToPublish() {
    if (!activeRunId) return;
    setExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setExporting(false);
    }
  }

  async function pingProvider() {
    setPinging(true);
    setPingInfo("");
    try {
      const res = await fetch("/api/agent/ping", { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setPingInfo("诊断失败：接口不可用");
      } else {
        const payload = data.data || {};
        setPingInfo(payload.ok ? `连接正常 · ${payload.latency_ms}ms` : `连接异常 · ${payload.message}`);
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
    ? liveArtifacts.map((item, idx) => ({ id: idx + 1, kind: item.kind, content: item.content }))
    : detail?.artifacts || [];

  const articleArtifact = [...artifactSource].find((item: any) => item.kind === "content");

  if (!token) {
    return <div className="studio-empty">请先登录后使用。</div>;
  }

  return (
    <div className="grid h-full min-h-[600px] grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="studio-panel studio-panel-glass flex flex-col overflow-visible">
        <div className="studio-section-head">
          <div>
            <h3 className="studio-section-title">新建创作任务</h3>
            <p className="studio-section-desc">配置 Agent 并开始创作。</p>
          </div>
          <button
            type="button"
            className="group flex items-center gap-2 rounded-lg bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            onClick={pingProvider}
            disabled={pinging}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                pinging ? "animate-pulse bg-amber-400" : "bg-zinc-500 group-hover:bg-blue-400"
              }`}
            />
            {pinging ? "..." : "Ping"}
          </button>
        </div>

        {pingInfo && <div className="mb-4 rounded bg-zinc-900/50 p-2 text-xs text-zinc-400">{pingInfo}</div>}

        <div className="studio-form-section flex flex-1 flex-col border-zinc-800/30 bg-zinc-900/35">
          <div className="mb-5 grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <label className="studio-label">Agent 类型</label>
              <div className="relative">
                <select
                  className="studio-input appearance-none pr-10 text-[15px]"
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value as AgentType)}
                >
                  <option value="topic">选题助手</option>
                  <option value="writing">写作助手</option>
                  <option value="publish">发布助手</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="studio-label">模型选择</label>
              <div className="relative">
                <select
                  className="studio-input appearance-none pr-12 text-[13px] leading-6"
                  value={agentModel}
                  onChange={(e) => setAgentModel(e.target.value as AgentModel)}
                  title={agentModel}
                >
                  <option value="gemini-3-pro">gemini-3-pro</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3 text-sm text-zinc-300">
            当前助手:
            <span className="ml-2 font-medium text-zinc-100">
              {selectedPreset ? selectedPreset.name : "默认系统助手"}
            </span>
          </div>

          <div className="flex flex-1 flex-col">
            <label className="studio-label">创作目标</label>
            <textarea
              className="studio-input studio-textarea min-h-[140px] flex-1 resize-none"
              placeholder="在此输入您的创作目标..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="studio-btn studio-btn-primary w-full py-3 text-base"
            onClick={createRun}
            disabled={creating}
          >
            {creating ? "正在创建..." : "开始创作"}
          </button>
        </div>

        {activeRunId && (
          <div className="mt-8 border-t border-zinc-800 pt-8">
            <h4 className="studio-title-3 mb-4">后续优化</h4>
            <div className="studio-form-section border-zinc-800/30 bg-zinc-900/35">
              <label className="studio-label">优化指令</label>
              <textarea
                className="studio-input min-h-[80px]"
                placeholder="输入优化建议..."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                className="studio-btn studio-btn-secondary flex-1"
                onClick={continueRun}
                disabled={continuing}
              >
                {continuing ? "优化中..." : "继续优化"}
              </button>
              <button
                className="studio-btn studio-btn-secondary flex-1"
                onClick={exportToPublish}
                disabled={exporting}
              >
                {exporting ? "导出中..." : "导出结果"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="studio-status studio-status-error mt-4">{error}</div>}
      </section>

      <section className="studio-panel studio-panel-glass flex flex-col">
        <div className="studio-section-head">
          <h3 className="studio-section-title">内容预览</h3>
          <div className="flex gap-4 text-xs text-zinc-500">
            <span>
              状态: <span className={summaryStatus === "running" ? "text-amber-400" : "text-zinc-300"}>{statusLabel(summaryStatus)}</span>
            </span>
            <span>更新时间: {formatDateTime(summaryUpdatedAt)}</span>
            <span>产物: {summaryArtifactCount}</span>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-1">
          {articleArtifact ? (
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-[15px] leading-8 text-zinc-300">{articleArtifact.content}</div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
              <p>暂无内容生成</p>
            </div>
          )}
        </div>

        {isStreaming && streamText && (
          <div className="custom-scrollbar mt-4 max-h-32 overflow-y-auto rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 font-mono text-xs text-amber-200/80">
            {streamText}
          </div>
        )}
      </section>
    </div>
  );
}
