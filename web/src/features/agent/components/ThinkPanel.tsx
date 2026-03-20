"use client";

import { useState } from "react";
import type { AgentConversationDto, AgentConversationMessage, AgentGoalPlanStep } from "@/features/agent/types";
import type { AgentTimelineEvent } from "@/features/agent/timeline";
import { CitationList } from "./CitationList";
import { LongTermMemoryBlock } from "./LongTermMemoryBlock";
import { getToolDisplayName } from "./agent-utils";

interface ThinkPanelProps {
  message: AgentConversationMessage;
  linkedGoal?: AgentGoalTimelineDto | null;
  conversationMemory: AgentConversationDto["conversation_memory"];
  longTermMemories: NonNullable<AgentConversationDto["long_term_memories"]>;
}

interface AgentGoalTimelineDto {
  goal: {
    id: string;
    status: string;
    summary: string;
    plan: {
      summary?: string;
      steps: AgentGoalPlanStep[];
    };
  };
  timeline: AgentGoalStep[];
  approvals: Array<{
    id: number;
    step_key: string;
    action: string;
    status: string;
    payload: unknown;
  }>;
  events?: AgentTimelineEvent[];
}

interface AgentGoalStep {
  id: number;
  step_key: string;
  kind: string;
  title: string;
  status: string;
  started_at: string;
  finished_at?: string;
  input?: unknown;
  output?: unknown;
}

function ThinkingIndicator({
  stages,
  tokenCount,
  isStreaming
}: {
  stages: Array<{ key: string; title: string; status: "pending" | "running" | "done" }>;
  tokenCount?: { input_tokens: number; output_tokens: number; total_tokens: number };
  isStreaming?: boolean;
}) {
  if (stages.length === 0 && !tokenCount) return null;

  const activeStage = stages.find(s => s.status === "running");
  const doneCount = stages.filter(s => s.status === "done").length;

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* Thinking progress */}
      <div className="flex items-center gap-1.5">
        {isStreaming && (
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
        )}
        <span className="text-zinc-400">
          {activeStage ? activeStage.title : stages.length > 0 ? `已完成 ${doneCount}/${stages.length}` : "思考中"}
        </span>
      </div>

      {/* Token count */}
      {tokenCount && (
        <>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">
            {tokenCount.total_tokens.toLocaleString()} tokens
          </span>
        </>
      )}
    </div>
  );
}

function ThinkingDetails({
  stages,
  timelineEvents,
  liveToolCalls,
  liveRetrievalHits,
  linkedGoal,
}: {
  stages: Array<{ key: string; title: string; status: "pending" | "running" | "done" }>;
  timelineEvents: AgentTimelineEvent[];
  liveToolCalls?: Array<{ tool_name: string; status: string; result_preview?: string }>;
  liveRetrievalHits?: Array<{ title: string; content_preview?: string; score?: number }>;
  linkedGoal?: AgentGoalTimelineDto | null;
}) {
  const toolEvents = timelineEvents.filter(e => e.kind === "tool_start" || e.kind === "tool_result");
  const completedSteps = linkedGoal?.timeline.filter(t => t.status === "done" || t.status === "failed") || [];

  return (
    <div className="space-y-3 pt-3">
      {/* 思考阶段进度 */}
      {stages.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">执行阶段</span>
          <div className="flex flex-wrap gap-1">
            {stages.map((stage) => (
              <span
                key={stage.key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  stage.status === "done"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : stage.status === "running"
                      ? "bg-sky-500/10 text-sky-400"
                      : "bg-white/5 text-zinc-500"
                }`}
              >
                {stage.status === "done" ? "✓" : stage.status === "running" ? "●" : "○"}
                {stage.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 工具调用 */}
      {(toolEvents.length > 0 || (liveToolCalls && liveToolCalls.length > 0)) && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">工具</span>
          <div className="flex flex-wrap gap-1">
            {(liveToolCalls?.length ? liveToolCalls : toolEvents).map((event, i) => {
              const name = "tool_name" in event ? event.tool_name : event.title;
              const status = event.status;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                    status === "done" || status === "completed"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : status === "running" || status === "started"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {getToolDisplayName(name || undefined)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 检索结果数 */}
      {liveRetrievalHits && liveRetrievalHits.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="text-zinc-500">检索到 {liveRetrievalHits.length} 条相关内容</span>
        </div>
      )}

      {/* 目标执行结果 */}
      {completedSteps.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">结果</span>
          <div className="text-xs text-zinc-400">
            {completedSteps.length} 个步骤已完成
          </div>
        </div>
      )}
    </div>
  );
}

export function ThinkPanel({ message, linkedGoal, conversationMemory, longTermMemories }: ThinkPanelProps) {
  const meta = message.meta;
  const isStreaming = message.local_status === "streaming" || message.local_status === "pending";

  const thinkingStages = meta?.thinking?.stages || [];
  const timelineEvents = Array.isArray(meta?.timeline_events) ? meta.timeline_events : [];
  const liveRetrievalHits = meta?.live_retrieval_hits || [];
  const liveToolCalls = meta?.live_tool_calls || [];
  const citations = Array.isArray(meta?.citations) ? meta.citations : [];
  const hasCitations = citations.length > 0;
  const hasMemory = !!conversationMemory?.summary || longTermMemories.length > 0;
  const hasTokenCount = !!meta?.token_count;

  // Minimal condition: show indicator if streaming or has any thinking data
  const hasThinking = thinkingStages.length > 0 || timelineEvents.length > 0 || liveToolCalls.length > 0 || liveRetrievalHits.length > 0;
  const shouldShow = isStreaming || hasThinking || hasCitations || hasMemory || hasTokenCount;

  const [isExpanded, setIsExpanded] = useState(false);

  if (!meta || !shouldShow) return null;

  return (
    <div className="agent-think-panel">
      {/* 简洁的思考状态栏 - 默认显示 */}
      <button
        type="button"
        className="w-full flex items-center justify-between py-1 text-zinc-500 hover:text-zinc-300 transition-colors duration-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ThinkingIndicator
          stages={thinkingStages}
          tokenCount={meta.token_count}
          isStreaming={isStreaming}
        />
        <span className="text-zinc-500 text-xs">
          {isExpanded ? "收起" : "详情"}
        </span>
      </button>

      {/* 展开的详细信息 */}
      {isExpanded && (
        <ThinkingDetails
          stages={thinkingStages}
          timelineEvents={timelineEvents}
          liveToolCalls={liveToolCalls}
          liveRetrievalHits={liveRetrievalHits}
          linkedGoal={linkedGoal}
        />
      )}

      {/* 引用列表 - 始终显示在展开区 */}
      {hasCitations && isExpanded && (
        <div className="mt-3">
          <CitationList citations={citations} />
        </div>
      )}

      {/* 记忆 - 始终显示在展开区 */}
      {hasMemory && isExpanded && (
        <div className="mt-3">
          <LongTermMemoryBlock memories={longTermMemories} />
        </div>
      )}
    </div>
  );
}
