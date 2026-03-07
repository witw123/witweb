"use client";

import { useState } from "react";
import { getVersionedApiPath } from "@/lib/api-version";

export type AgentModel = "gemini-3-pro" | "gemini-2.5-pro" | "gemini-2.5-flash";
export type AgentType = "topic" | "writing" | "publish";

export type LiveArtifact = {
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

  const upsertLiveArtifact = (next: LiveArtifact) => {
    setLiveArtifacts((prev) => {
      const idx = prev.findIndex((item) => item.kind === next.kind);
      if (idx < 0) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  };

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
    createRun,
    creating,
    activeRunId,
    setActiveRunId,
    isStreaming,
    streamStatus,
    streamUpdatedAt,
    liveArtifacts,
    streamText,
    createError,
    setCreateError,
  };
}
