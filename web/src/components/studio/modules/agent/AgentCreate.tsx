"use client";

/**
 * AgentCreate AI创作任务创建组件
 *
 * 用于创建和管理 AI 创作任务：
 * - 选择 Agent 类型（选题/写作/发布）
 * - 选择 AI 模型
 * - 设置创作目标和系统提示词
 * - 实时预览生成内容
 * - 继续优化和导出结果
 *
 * @component
 * @example
 * <AgentCreate onTaskCreated={(taskId) => console.log(taskId)} />
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { logError } from "@/lib/logger";
import {
  AGENT_PRESET_EVENT,
  readSelectedPreset,
  type AgentPreset,
} from "./agent-preset-storage";
import { useAgentPing } from "./hooks/useAgentPing";
import { useAgentRunDetail, type AgentType } from "./hooks/useAgentRunDetail";
import { useContinueAgentRun } from "./hooks/useContinueAgentRun";
import { useCreateAgentRun, type AgentModel } from "./hooks/useCreateAgentRun";

/**
 * 将状态码转换为可读标签
 */
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

/**
 * 格式化日期时间为本地字符串
 */
function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * AgentCreate 组件属性
 */
interface AgentCreateProps {
  onTaskCreated?: (taskId: string) => void;
}

/**
 * AgentCreate 组件 - AI创作任务创建
 */
export function AgentCreate({ onTaskCreated }: AgentCreateProps) {
  const { isAuthenticated } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [goal, setGoal] = useState("");
  const [agentType, setAgentType] = useState<AgentType>("writing");
  const [agentModel, setAgentModel] = useState<AgentModel>("gemini-3-pro");
  const [instruction, setInstruction] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<AgentPreset | null>(null);

  const {
    createRun,
    creating,
    activeRunId,
    isStreaming,
    streamStatus,
    streamUpdatedAt,
    liveArtifacts,
    streamText,
    createError,
  } = useCreateAgentRun({
    isAuthenticated,
    onTaskCreated,
    onDone: async (runId) => {
      await refreshDetail(runId);
    },
    onError: (hookError, context) => {
      logError({
        source: "agent.create-run",
        error: hookError,
        context,
      });
    },
  });

  const { detail, detailError, refreshDetail } = useAgentRunDetail(
    isAuthenticated,
    activeRunId,
    !isStreaming
  );

  const { continueRun, continuing } = useContinueAgentRun(isAuthenticated, {
    onSuccess: async (runId) => {
      setInstruction("");
      await refreshDetail(runId);
    },
    onError: (mutationError, input) => {
      logError({
        source: "agent.continue-run",
        error: mutationError,
        context: {
          runId: input.runId,
          instructionLength: input.instruction.trim().length,
          agentModel: input.model,
        },
      });
      setError(mutationError instanceof Error ? mutationError.message : "继续优化失败");
    },
  });

  const { pingInfo, pinging, pingProvider } = useAgentPing(isAuthenticated, {
    onError: (mutationError) => {
      logError({
        source: "agent.ping",
        error: mutationError,
      });
    },
  });

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

  useEffect(() => {
    if (detailError) setError(detailError);
  }, [detailError]);

  useEffect(() => {
    if (createError) setError(createError);
  }, [createError]);

  function collectCustomPayload() {
    if (!selectedPreset?.systemPrompt?.trim()) return {};
    return {
      assistant_name: selectedPreset.assistantName.trim() || undefined,
      custom_system_prompt: selectedPreset.systemPrompt.trim() || undefined,
    };
  }

  async function handleCreateRun() {
    setError("");
    try {
      await createRun({
        goal,
        agentType,
        agentModel,
        payload: collectCustomPayload(),
      });
      setGoal("");
    } catch {
      // handled in hook
    }
  }

  async function handleContinueRun() {
    if (!activeRunId || !instruction.trim()) {
      setError("请先输入优化指令");
      return;
    }

    setError("");
    try {
      await continueRun({
        runId: activeRunId,
        instruction,
        model: agentModel,
        payload: collectCustomPayload(),
      });
    } catch {
      // handled by mutation
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

  const summaryStatus = isStreaming ? streamStatus : detail?.run?.status || "--";
  const summaryUpdatedAt = isStreaming
    ? streamUpdatedAt
    : detail?.run?.updated_at || "";
  const summaryArtifactCount = isStreaming
    ? liveArtifacts.length
    : detail?.artifacts?.length || 0;

  const artifactSource = isStreaming
    ? liveArtifacts.map((item, idx) => ({
        id: idx + 1,
        kind: item.kind,
        content: item.content,
      }))
    : detail?.artifacts || [];

  const articleArtifact = [...artifactSource].find(
    (item) => item.kind === "content"
  );

  if (!isAuthenticated) {
    return <div className="studio-empty">请先登录后使用。</div>;
  }

  return (
    <div className="agent-workspace">
      <section className="agent-panel-left studio-panel studio-panel-glass">
        <div className="agent-panel-header">
          <div>
            <h3 className="agent-panel-title">新建创作任务</h3>
            <p className="agent-panel-desc">设置目标后开始生成，并可持续迭代。</p>
          </div>
          <button
            type="button"
            className="agent-ping-btn"
            onClick={() => void pingProvider()}
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
            <select
              className="studio-input"
              value={agentType}
              onChange={(e) => setAgentType(e.target.value as AgentType)}
            >
              <option value="topic">选题助手</option>
              <option value="writing">写作助手</option>
              <option value="publish">发布助手</option>
            </select>
          </div>
          <div>
            <label className="studio-label">模型选择</label>
            <select
              className="studio-input"
              value={agentModel}
              onChange={(e) => setAgentModel(e.target.value as AgentModel)}
            >
              <option value="gemini-3-pro">gemini-3-pro</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
          </div>
        </div>

        <div className="agent-assistant-banner">
          <span className="label">当前助手</span>
          <span className="value">
            {selectedPreset ? selectedPreset.name : "默认系统助手"}
          </span>
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

        <button
          type="button"
          className="studio-btn studio-btn-primary agent-cta"
          onClick={handleCreateRun}
          disabled={creating}
        >
          {creating ? "正在创建..." : "开始创作"}
        </button>

        {activeRunId && (
          <div className="agent-followup">
            <h4 className="studio-title-3">后续优化</h4>
            <textarea
              className="studio-input"
              placeholder="输入优化方向，例如更专业、增加案例、加强结论..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className="agent-followup-actions">
              <button
                className="studio-btn studio-btn-secondary"
                onClick={handleContinueRun}
                disabled={continuing}
              >
                {continuing ? "优化中..." : "继续优化"}
              </button>
              <button
                className="studio-btn studio-btn-secondary"
                onClick={exportToPublish}
                disabled={exporting}
              >
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
              <div className="whitespace-pre-wrap leading-8 text-zinc-200">
                {articleArtifact.content}
              </div>
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
