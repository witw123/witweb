"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";
import { AGENT_PRESET_EVENT, readSelectedPreset, type AgentPreset } from "./agent-preset-storage";

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

type StreamEvent = {
  type?: string;
  run_id?: string;
  text?: string;
  kind?: string;
  content?: string;
  message?: string;
};

function toStreamEvent(input: unknown): StreamEvent | null {
  if (!input || typeof input !== "object") return null;
  return input as StreamEvent;
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
    const syncPreset = () => setSelectedPreset(readSelectedPreset());
    syncPreset();
    window.addEventListener(AGENT_PRESET_EVENT, syncPreset);
    window.addEventListener("focus", syncPreset);
    return () => {
      window.removeEventListener(AGENT_PRESET_EVENT, syncPreset);
      window.removeEventListener("focus", syncPreset);
    };
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

          let evt: StreamEvent | null = null;
          try {
            evt = toStreamEvent(JSON.parse(trimmed));
          } catch {
            continue;
          }
          if (!evt) continue;

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
        setPingInfo("连接检查失败：接口不可用");
      } else {
        const payload = (data?.data || {}) as { ok?: boolean; latency_ms?: number; message?: string };
        setPingInfo(payload.ok ? `连接正常 · ${payload.latency_ms}ms` : `连接异常 · ${payload.message}`);
      }
    } catch {
      setPingInfo("连接检查失败：网络异常");
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

  const articleArtifact = [...artifactSource].find((item) => item.kind === "content");

  if (!token) {
    return <div className="studio-empty">请先登录后使用。</div>;
  }

  return (
    <div className="agent-workspace">
      <section className="agent-panel-left studio-panel studio-panel-glass">
        <div className="agent-panel-header">
          <div>
            <h3 className="agent-panel-title">新建创作任务</h3>
            <p className="agent-panel-desc">设置目标后开始生成，可持续迭代。</p>
          </div>
          <button
            type="button"
            className="agent-ping-btn"
            onClick={pingProvider}
            disabled={pinging}
          >
            <span className={`agent-ping-dot ${pinging ? "is-pinging" : ""}`} />
            {pinging ? "检测中" : "Ping"}
          </button>
        </div>

        {pingInfo && <div className="agent-inline-info">{pingInfo}</div>}

        <div className="agent-form-grid">
          <div>
            <label className="studio-label">Agent 类型</label>
            <select className="studio-input" value={agentType} onChange={(e) => setAgentType(e.target.value as AgentType)}>
              <option value="topic">选题助手</option>
              <option value="writing">写作助手</option>
              <option value="publish">发布助手</option>
            </select>
          </div>
          <div>
            <label className="studio-label">模型选择</label>
            <select className="studio-input" value={agentModel} onChange={(e) => setAgentModel(e.target.value as AgentModel)}>
              <option value="gemini-3-pro">gemini-3-pro</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
          </div>
        </div>

        <div className="agent-assistant-banner">
          <span className="label">当前助手</span>
          <span className="value">{selectedPreset ? selectedPreset.name : "默认系统助手"}</span>
        </div>

        <div className="agent-field-block">
          <label className="studio-label">创作目标</label>
          <textarea
            className="studio-input studio-textarea"
            placeholder="描述你要生成的文章目标、受众和风格..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <button type="button" className="studio-btn studio-btn-primary agent-cta" onClick={createRun} disabled={creating}>
          {creating ? "正在创建..." : "开始创作"}
        </button>

        {activeRunId && (
          <div className="agent-followup">
            <h4 className="studio-title-3">后续优化</h4>
            <textarea
              className="studio-input"
              placeholder="输入优化方向：例如更专业、增加案例、加强结论..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className="agent-followup-actions">
              <button className="studio-btn studio-btn-secondary" onClick={continueRun} disabled={continuing}>
                {continuing ? "优化中..." : "继续优化"}
              </button>
              <button className="studio-btn studio-btn-secondary" onClick={exportToPublish} disabled={exporting}>
                {exporting ? "导出中..." : "导出结果"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="studio-status studio-status-error">{error}</div>}
      </section>

      <section className="agent-panel-right studio-panel studio-panel-glass">
        <div className="agent-preview-head">
          <h3 className="agent-panel-title agent-preview-title">内容预览</h3>
          <div className="agent-preview-meta">
            <span>状态: {statusLabel(summaryStatus)}</span>
            <span>更新时间: {formatDateTime(summaryUpdatedAt)}</span>
            <span>产物: {summaryArtifactCount}</span>
          </div>
        </div>

        <div className="agent-preview-body custom-scrollbar">
          {articleArtifact ? (
            <article className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap leading-8 text-zinc-200">{articleArtifact.content}</div>
            </article>
          ) : (
            <div className="agent-empty-state">暂无内容生成</div>
          )}
        </div>

        {isStreaming && streamText && (
          <div className="agent-stream-log custom-scrollbar">{streamText}</div>
        )}
      </section>
    </div>
  );
}
