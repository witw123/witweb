/**
 * useCreateAgentRun Hook
 *
 * 提供 Agent 任务创建功能
 * 通过 Server-Sent Events (SSE) 流式接收任务执行结果
 * 支持创建新任务并实时获取生成的文本和产物
 */

"use client";

import { useState } from "react";
import { getVersionedApiPath } from "@/lib/api-version";

/** Agent 使用的模型类型 */
export type AgentModel = "gemini-3-pro" | "gemini-2.5-pro" | "gemini-2.5-flash";
/** Agent 任务类型 */
export type AgentType = "topic" | "writing" | "publish";

/**
 * 实时产物
 * Agent 在执行过程中实时生成的产物
 */
export type LiveArtifact = {
  /** 产物类型 */
  kind: string;
  /** 产物内容 */
  content: string;
};

/** SSE 流事件类型 */
type StreamEvent = {
  type?: string;
  run_id?: string;
  text?: string;
  kind?: string;
  content?: string;
  message?: string;
};

/**
 * 将未知类型转换为流事件
 *
 * @param {unknown} input - 输入数据
 * @returns {StreamEvent | null} 转换后的事件或 null
 */
function toStreamEvent(input: unknown): StreamEvent | null {
  if (!input || typeof input !== "object") return null;
  return input as StreamEvent;
}

/**
 * useCreateAgentRun - 创建 Agent 任务 Hook
 *
 * 通过 SSE 流式创建 Agent 任务，实时获取执行结果
 *
 * @param {Object} options - Hook 配置
 * @param {boolean} options.isAuthenticated - 用户是否已登录
 * @param {Function} [options.onError] - 错误回调
 * @param {Function} [options.onTaskCreated] - 任务创建完成回调
 * @param {Function} [options.onDone] - 任务完成回调
 * @returns 包含创建方法和状态的对象
 */
export function useCreateAgentRun(options: {
  isAuthenticated: boolean;
  onError?: (error: unknown, context?: Record<string, unknown>) => void;
  onTaskCreated?: (taskId: string) => void;
  onDone?: (runId: string) => Promise<void> | void;
}) {
  const [creating, setCreating] = useState(false);
  const [activeRunId, setActiveRunId] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("idle");
  const [streamUpdatedAt, setStreamUpdatedAt] = useState("");
  const [liveArtifacts, setLiveArtifacts] = useState<LiveArtifact[]>([]);
  const [streamText, setStreamText] = useState("");
  const [createError, setCreateError] = useState("");

  /**
   * 更新或添加实时产物
   * 同类型的产物会被覆盖
   */
  const upsertLiveArtifact = (next: LiveArtifact) => {
    setLiveArtifacts((prev) => {
      const idx = prev.findIndex((item) => item.kind === next.kind);
      if (idx < 0) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  };

  /**
   * 创建新的 Agent 任务
   * 通过 SSE 流式获取执行结果
   */
  const createRun = async (input: {
    goal: string;
    agentType: AgentType;
    agentModel: AgentModel;
    payload?: Record<string, unknown>;
  }) => {
    if (!options.isAuthenticated) {
      const err = new Error("请先登录后再使用。");
      setCreateError(err.message);
      throw err;
    }
    if (!input.goal.trim()) {
      const err = new Error("请先输入创作目标");
      setCreateError(err.message);
      throw err;
    }

    setCreateError("");
    setCreating(true);
    setActiveRunId("");
    setIsStreaming(true);
    setStreamStatus("running");
    setStreamUpdatedAt(new Date().toISOString());
    setLiveArtifacts([]);
    setStreamText("");

    try {
      const res = await fetch(getVersionedApiPath("/agent/runs/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_type: input.agentType,
          model: input.agentModel,
          goal: input.goal.trim(),
          ...(input.payload || {}),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data?.error?.message || "创建任务失败");
        setCreateError(err.message);
        setStreamStatus("failed");
        options.onError?.(err, {
          status: res.status,
          agentType: input.agentType,
          agentModel: input.agentModel,
          goalLength: input.goal.trim().length,
        });
        throw err;
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
            options.onError?.("Invalid stream payload", {
              line: trimmed.slice(0, 300),
              activeRunId: runId || null,
            });
            continue;
          }

          if (!evt) continue;
          setStreamUpdatedAt(new Date().toISOString());

          if (evt.type === "run_created") {
            runId = String(evt.run_id || "");
            if (runId) setActiveRunId(runId);
          }

          if (evt.type === "delta") {
            setStreamText((prev) =>
              `${prev}${String(evt.text || "")}`.slice(-2000)
            );
          }

          if (evt.type === "artifact") {
            upsertLiveArtifact({
              kind: String(evt.kind || "artifact"),
              content: String(evt.content || ""),
            });
          }

          if (evt.type === "error") {
            const err = new Error(String(evt.message || "生成失败"));
            setCreateError(err.message);
            setStreamStatus("failed");
            options.onError?.(err, {
              runId: String(evt.run_id || runId || ""),
              agentType: input.agentType,
              agentModel: input.agentModel,
            });
          }

          if (evt.type === "done") {
            setStreamStatus("done");
            const doneRunId = String(evt.run_id || runId || "");
            if (doneRunId) {
              setActiveRunId(doneRunId);
              await options.onDone?.(doneRunId);
              options.onTaskCreated?.(doneRunId);
            }
          }
        }
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        setCreateError("创建任务失败");
      }
      throw error;
    } finally {
      setCreating(false);
      setIsStreaming(false);
    }
  };

  return {
    /** 创建 Agent 任务 */
    createRun,
    /** 是否正在创建 */
    creating,
    /** 当前活动的任务 ID */
    activeRunId,
    /** 设置当前活动任务 ID */
    setActiveRunId,
    /** 是否正在流式传输 */
    isStreaming,
    /** 流状态 */
    streamStatus,
    /** 最后更新时间 */
    streamUpdatedAt,
    /** 实时产物列表 */
    liveArtifacts,
    /** 流式文本内容 */
    streamText,
    /** 创建错误信息 */
    createError,
    /** 设置错误信息 */
    setCreateError,
  };
}
