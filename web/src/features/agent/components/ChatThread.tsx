"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get, getErrorMessage, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import type {
  AgentCitation,
  AgentConversationDto,
  AgentConversationMessage,
  AgentGoalApproval,
  AgentGoalPlanStep,
  AgentGoalStep,
  AgentGoalTimelineDto,
} from "@/features/agent/types";
import type { AgentTimelineEvent } from "@/features/agent/timeline";
import { ChatInput } from "./ChatInput";

interface ChatThreadProps {
  activeConversationId: string | null;
  draftGoal: string;
  draftTaskType: string;
  onDraftGoalChange: (value: string) => void;
  onDraftTaskTypeChange: (value: string) => void;
  onConversationCreated: (id: string) => void;
}

const SUGGESTIONS = [
  {
    title: "撰写行业热点文章",
    desc: "自动整理近期主题和站内知识，生成适合个人博客发布的草稿。",
    taskType: "hot_topic_article",
    prompt: "结合我的创作方向，分析近期 AI 行业热点，并生成一篇适合个人博客发布的文章草稿。",
  },
  {
    title: "根据草稿继续写",
    desc: "保持现有语气和结构，把零散片段扩展成完整文章。",
    taskType: "continue_article",
    prompt: "我有一段草稿想继续扩写，请保持原有语气和结构，将其扩展成完整文章。",
  },
  {
    title: "图文转短视频脚本",
    desc: "把博客文章整理成适合短视频的解说脚本和提示词。",
    taskType: "article_to_video",
    prompt: "请把我的图文内容整理成适合短视频的解说脚本和提示词，暂时不发起视频生成。",
  },
  {
    title: "批量生成发布草稿",
    desc: "输出标题、摘要、SEO 和分发文案，方便后续多平台发布。",
    taskType: "publish_draft",
    prompt: "请基于现有内容生成可分发的发布草稿，优先输出标题、摘要、SEO 和分发文案。",
  },
] as const;

function statusLabel(status?: string) {
  if (status === "running") return "进行中";
  if (status === "done") return "已完成";
  if (status === "failed") return "失败";
  if (status === "pending") return "等待中";
  if (status === "waiting_approval") return "待审批";
  if (status === "skipped_waiting_approval") return "等待恢复";
  return status || "--";
}

function getDisplayStepTitle(step: Pick<AgentGoalPlanStep, "step_key" | "title" | "tool_name">) {
  if (step.step_key === "create_video" || step.tool_name === "video.generate") {
    return "生成视频提示词";
  }
  return step.title;
}

function getToolDisplayName(toolName?: string) {
  if (!toolName) return "";
  const mapping: Record<string, string> = {
    "profile.read": "读取创作者资料",
    "blog.list_posts": "查询历史文章",
    "blog.create_post": "保存博客草稿",
    "radar.fetch_and_analyze": "分析近期热点",
    "knowledge.search": "检索知识库",
    "messages.create_draft": "生成私信草稿",
    "messages.send": "发送站内消息",
    "integrations.n8n_dispatch": "触发外部分发",
    "video.generate": "生成视频提示词",
  };
  return mapping[toolName] || toolName;
}

function getStepDecisionLabel(step: AgentGoalPlanStep) {
  if (step.kind === "tool") return `已选择工具: ${getToolDisplayName(step.tool_name)}`;
  if (step.kind === "llm") return "已选择模型生成内容";
  return "已选择分析步骤";
}

function getDisplayApprovalAction(approval: Pick<AgentGoalApproval, "action" | "step_key">) {
  if (approval.step_key === "create_video" || approval.action === "video.generate") {
    return "生成视频提示词";
  }
  if (approval.action === "blog.create_post") return "保存博客草稿";
  return approval.action;
}

function getStepOutputObject(output: AgentGoalStep["output"]) {
  return output && typeof output === "object" && !Array.isArray(output)
    ? (output as Record<string, unknown>)
    : null;
}

function getOutputCards(item: AgentGoalStep) {
  const output = getStepOutputObject(item.output);
  if (!output) return [];

  if (output.reason === "video_generation_disabled_temporarily") {
    return [
      {
        key: "video-disabled",
        label: "视频生成",
        value: "当前仅输出脚本和提示词，未真正发起视频生成任务。",
        tone: "warning" as const,
      },
    ];
  }

  const result = getStepOutputObject(output.result);
  const seo = getStepOutputObject(output.seo);
  const cards: Array<{ key: string; label: string; value: string; tone?: "warning" | "default" | "success" }> = [];

  if (typeof output.title === "string" && output.title.trim()) {
    cards.push({ key: "title", label: "文章标题", value: output.title.trim() });
  }
  if (typeof output.content === "string" && output.content.trim()) {
    const content = output.content.trim();
    cards.push({ key: "content", label: "正文摘要", value: content.length > 280 ? `${content.slice(0, 280)}...` : content });
  }
  if (seo) {
    const lines = [
      typeof seo.title === "string" && seo.title ? `SEO Title: ${seo.title}` : "",
      typeof seo.description === "string" && seo.description ? `Description: ${seo.description}` : "",
      Array.isArray(seo.keywords) && seo.keywords.length ? `Keywords: ${seo.keywords.join(", ")}` : "",
    ].filter(Boolean);
    if (lines.length > 0) cards.push({ key: "seo", label: "SEO", value: lines.join("\n") });
  }
  if (typeof output.coverPrompt === "string" && output.coverPrompt.trim()) {
    cards.push({ key: "cover", label: "封面提示词", value: output.coverPrompt.trim() });
  }
  if (typeof output.videoPrompt === "string" && output.videoPrompt.trim()) {
    cards.push({ key: "video", label: "视频脚本 / 提示词", value: output.videoPrompt.trim() });
  }
  if (result && typeof result.id !== "undefined") {
    const lines = [
      typeof result.id !== "undefined" ? `ID: ${String(result.id)}` : "",
      typeof result.slug === "string" && result.slug ? `Slug: ${result.slug}` : "",
      typeof result.status === "string" && result.status ? `Status: ${result.status}` : "",
    ].filter(Boolean);
    cards.push({ key: "post-result", label: "草稿保存结果", value: lines.join("\n"), tone: "success" });
  }
  if (cards.length === 0 && item.status === "failed" && typeof output.error === "string") {
    cards.push({ key: "error", label: "执行错误", value: output.error, tone: "warning" });
  }
  if (cards.length === 0) {
    cards.push({ key: "raw", label: "原始输出", value: JSON.stringify(item.output, null, 2) });
  }
  return cards;
}

function summarizeOutputCards(cards: Array<{ label: string; value: string; tone?: "warning" | "default" | "success" }>) {
  if (cards.length === 0) return "无可用结果";
  const first = cards[0];
  const compactValue = first.value.replace(/\s+/g, " ").trim();
  const preview = compactValue.length > 96 ? `${compactValue.slice(0, 96)}...` : compactValue;
  return `${first.label}: ${preview}`;
}

function CitationList({ citations }: { citations: AgentCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Citations</div>
      <div className="mt-2 space-y-2 text-sm text-zinc-300">
        {citations.map((citation) => (
          <div key={`${citation.document_id}:${citation.chunk_index}`} className="rounded-xl bg-white/5 px-3 py-3">
            {citation.href ? (
              <Link href={citation.href} className="font-medium text-sky-300 transition hover:text-sky-200 hover:underline">
                {citation.title || citation.document_id}
              </Link>
            ) : (
              <div className="font-medium text-white">{citation.title || citation.document_id}</div>
            )}
            <div className="mt-1 text-xs text-zinc-500">
              {citation.source_type || citation.document_id} / chunk {citation.chunk_index}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThinkPanel({
  message,
  linkedGoal,
  conversationMemory,
  longTermMemories,
}: {
  message: AgentConversationMessage;
  linkedGoal?: AgentGoalTimelineDto | null;
  conversationMemory: AgentConversationDto["conversation_memory"];
  longTermMemories: NonNullable<AgentConversationDto["long_term_memories"]>;
}) {
  const meta = message.meta;
  if (!meta) return null;
  const citations = Array.isArray(meta.citations) ? meta.citations : [];
  const thinkingStages = meta.thinking?.stages || [];
  const timelineEvents = Array.isArray(meta.timeline_events) ? meta.timeline_events : [];
  const hasExecution = !!meta.execution_stage || thinkingStages.some((item) => item.key === "goal");
  const hasTimeline = timelineEvents.length > 0;
  const planSteps = linkedGoal?.goal.plan.steps || [];
  const [activeTab, setActiveTab] = useState<"search" | "memory" | "citations" | "timeline" | "execution">(
    hasExecution ? "execution" : hasTimeline ? "timeline" : "search"
  );
  useEffect(() => {
    if (hasExecution) {
      setActiveTab("execution");
      return;
    }
    if (hasTimeline && activeTab === "search") {
      setActiveTab("timeline");
    }
  }, [activeTab, hasExecution, hasTimeline]);
  const currentStage = meta.thinking?.current_stage || thinkingStages.find((item) => item.status === "running")?.key || "";
  const activeStageTitle =
    thinkingStages.find((item) => item.key === currentStage)?.title ||
    thinkingStages.find((item) => item.status === "running")?.title ||
    "查看检索、记忆和引用";
  const thinkSummary =
    thinkingStages.length > 0
      ? activeStageTitle
      : hasExecution
        ? "查看执行计划、轨迹和结果"
        : hasTimeline
          ? "查看检索、记忆、引用和时间线"
          : "查看检索、记忆和引用";
  const hasMemory =
    !!conversationMemory?.summary ||
    (conversationMemory?.key_points?.length || 0) > 0 ||
    longTermMemories.length > 0 ||
    !!meta.memory_used?.conversation_summary;
  const hasMeta =
    !!meta.rag_strategy ||
    typeof meta.knowledge_hit_count === "number" ||
    typeof meta.citation_count === "number" ||
    typeof meta.retrieval_confidence === "number" ||
    citations.length > 0 ||
    !!meta.memory_used?.conversation_summary ||
    thinkingStages.length > 0 ||
    hasExecution ||
    timelineEvents.length > 0 ||
    planSteps.length > 0 ||
    hasMemory;
  if (!hasMeta) return null;

  return (
    <details className={`agent-think-panel ${message.local_status === "pending" ? "agent-think-panel--live" : ""}`}>
      <summary className="agent-think-panel__summary">
        <div className="agent-think-panel__summary-main">
          <span className="agent-think-panel__label">思考</span>
          <span className="agent-think-panel__hint">{thinkSummary}</span>
        </div>
        <div className="agent-think-panel__chips">
          {thinkingStages.length > 0 ? <span className="agent-think-chip is-live">进行中</span> : null}
          {meta.rag_strategy ? <span className="agent-think-chip">{meta.rag_strategy}</span> : null}
          {typeof meta.knowledge_hit_count === "number" ? <span className="agent-think-chip">{meta.knowledge_hit_count} 条命中</span> : null}
          {typeof meta.citation_count === "number" ? <span className="agent-think-chip">{meta.citation_count} 条引用</span> : null}
          {hasTimeline ? <span className="agent-think-chip">{timelineEvents.length} 条事件</span> : null}
        </div>
      </summary>
      <div className="agent-think-panel__body">
        {thinkingStages.length > 0 ? (
          <div className="agent-think-shell" aria-live="polite">
            <div className="agent-think-shell__head">
              <div className="agent-think-shell__badge">思考中</div>
              <div className="agent-think-shell__pulse" aria-hidden="true" />
            </div>
            <div className="agent-think-shell__title">{activeStageTitle}</div>
            <div className="agent-think-shell__steps">
              {thinkingStages.map((stage) => (
                <div
                  key={stage.key}
                  className={`agent-think-shell__step ${stage.status === "running" ? "is-active" : stage.status === "done" ? "is-done" : ""}`}
                >
                  {stage.title}
                </div>
              ))}
            </div>
            <div className="agent-think-shell__lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        <div className="agent-think-tabs" role="tablist" aria-label="Think panels">
          <button
            type="button"
            className={`agent-think-tab ${activeTab === "search" ? "is-active" : ""}`}
            onClick={() => setActiveTab("search")}
          >
            检索
          </button>
          <button
            type="button"
            className={`agent-think-tab ${activeTab === "memory" ? "is-active" : ""}`}
            onClick={() => setActiveTab("memory")}
          >
            记忆
          </button>
          <button
            type="button"
            className={`agent-think-tab ${activeTab === "citations" ? "is-active" : ""}`}
            onClick={() => setActiveTab("citations")}
          >
            引用
          </button>
          {hasTimeline ? (
            <button
              type="button"
              className={`agent-think-tab ${activeTab === "timeline" ? "is-active" : ""}`}
              onClick={() => setActiveTab("timeline")}
            >
              时间线
            </button>
          ) : null}
          {hasExecution ? (
            <button
              type="button"
              className={`agent-think-tab ${activeTab === "execution" ? "is-active" : ""}`}
              onClick={() => setActiveTab("execution")}
            >
              执行
            </button>
          ) : null}
        </div>
        {activeTab === "search" ? (
          <div className="agent-think-metrics">
            {meta.rag_strategy ? (
              <div className="agent-think-metric">
                <span>检索策略</span>
                <strong>{meta.rag_strategy}</strong>
              </div>
            ) : null}
            {typeof meta.knowledge_hit_count === "number" ? (
              <div className="agent-think-metric">
                <span>命中数</span>
                <strong>{meta.knowledge_hit_count}</strong>
              </div>
            ) : null}
            {typeof meta.citation_count === "number" ? (
              <div className="agent-think-metric">
                <span>引用数</span>
                <strong>{meta.citation_count}</strong>
              </div>
            ) : null}
            {typeof meta.retrieval_confidence === "number" ? (
              <div className="agent-think-metric">
                <span>置信度</span>
                <strong>{meta.retrieval_confidence.toFixed(2)}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
        {activeTab === "memory" ? (
          <div className="space-y-3">
            {conversationMemory?.summary || meta.memory_used?.conversation_summary ? (
              <div className="agent-think-section">
                <div className="agent-think-section__label">会话摘要</div>
                <div className="agent-think-section__content">
                  {conversationMemory?.summary || meta.memory_used?.conversation_summary}
                </div>
                {conversationMemory?.key_points?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    {conversationMemory.key_points.map((item, index) => (
                      <span key={`${index}-${item}`} className="rounded-full bg-white/10 px-2 py-1">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {longTermMemories.length > 0 ? <LongTermMemoryBlock memories={longTermMemories} /> : null}
          </div>
        ) : null}
        {activeTab === "citations" ? <CitationList citations={citations} /> : null}
        {activeTab === "timeline" ? (
          <div className="space-y-3">
            <div className="agent-think-section">
              <div className="agent-think-section__label">时间线事件</div>
              <div className="space-y-2">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300">
                    <div className="font-medium text-white">{event.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {statusLabel(event.status)}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {activeTab === "execution" ? (
          <div className="space-y-3">
            {linkedGoal?.goal.plan.summary ? (
              <div className="agent-think-section">
                <div className="agent-think-section__label">计划摘要</div>
                <div className="agent-think-section__content">{linkedGoal.goal.plan.summary}</div>
              </div>
            ) : null}
            {planSteps.length > 0 ? (
              <div className="agent-think-section">
                <div className="agent-think-section__label">执行计划</div>
                <div className="space-y-2">
                  {planSteps.map((step) => (
                    <div key={`plan-${step.step_key}`} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{getDisplayStepTitle(step)}</div>
                        <span className={`agent-status-chip is-${step.status}`}>{statusLabel(step.status)}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{getStepDecisionLabel(step)}</div>
                      {step.rationale ? <div className="mt-2 text-xs leading-5 text-zinc-400">{step.rationale}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {meta.execution_stage ? (
              <div className="agent-think-section">
                <div className="agent-think-section__label">执行阶段</div>
                <div className="agent-think-section__content">{meta.execution_stage}</div>
              </div>
            ) : null}
            {thinkingStages.length > 0 ? (
              <div className="agent-think-section">
                <div className="agent-think-section__label">执行轨迹</div>
                <div className="space-y-2">
                  {thinkingStages.map((stage) => (
                    <div key={`execution-${stage.key}`} className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300">
                      <div className="font-medium text-white">{stage.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{statusLabel(stage.status)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function LongTermMemoryBlock({
  memories,
}: {
  memories: NonNullable<AgentConversationDto["long_term_memories"]>;
}) {
  if (!memories.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-zinc-300">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-300">长期记忆</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {memories.map((item) => (
          <div key={`${item.key}:${item.value}`} className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-zinc-400">{item.key}</div>
            <div className="mt-1 text-white">{item.value}</div>
            <div className="mt-1 text-xs text-zinc-500">
              置信度 {item.confidence.toFixed(2)} / {item.source}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalThreadBlock({
  goalTimeline,
  liveEvents,
  approvalError,
  onApprove,
  approvalPending,
}: {
  goalTimeline: AgentGoalTimelineDto;
  liveEvents: AgentTimelineEvent[];
  approvalError: string;
  onApprove: (approvalId: number) => void;
  approvalPending: boolean;
}) {
  const pendingApprovals = goalTimeline.approvals.filter((approval) => approval.status === "pending");
  const completedSteps = goalTimeline.timeline.filter((item) => item.status === "done" || item.status === "failed");
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const primaryApproval = pendingApprovals[0] || null;

  useEffect(() => {
    if (primaryApproval) {
      setIsApprovalModalOpen(true);
    }
  }, [primaryApproval?.id]);

  const approvalPreview = (() => {
    if (!primaryApproval) return "";
    const payload = primaryApproval.payload as { title?: string; excerpt?: string; content?: string; status?: string } | undefined;
    if (typeof payload?.content === "string" && payload.content.trim()) {
      return payload.content.trim().slice(0, 240);
    }
    if (typeof payload?.excerpt === "string" && payload.excerpt.trim()) {
      return payload.excerpt.trim();
    }
    if (typeof payload?.title === "string" && payload.title.trim()) {
      return payload.title.trim();
    }
    return "";
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="agent-think-panel__label">Goal 状态</span>
        <span className={`agent-status-chip is-${goalTimeline.goal.status}`}>{statusLabel(goalTimeline.goal.status)}</span>
        {pendingApprovals.length > 0 ? (
          <span className="agent-think-chip">{pendingApprovals.length} 项待审批</span>
        ) : null}
        {completedSteps.length > 0 ? <span className="agent-think-chip">{completedSteps.length} 项结果</span> : null}
      </div>

      {goalTimeline.approvals.length > 0 ? (
        <div className="agent-approval-inline">
          <div className="agent-approval-inline__copy">
            <span className="agent-think-panel__label">等待确认</span>
            <span className="agent-think-panel__hint">
              {pendingApprovals.length > 0 ? `${getDisplayApprovalAction(primaryApproval!)}，确认后自动继续执行` : "已确认"}
            </span>
          </div>
          {approvalError ? <div className="text-sm text-red-400">{approvalError}</div> : null}
        </div>
      ) : null}

      {primaryApproval && isApprovalModalOpen ? (
        <div className="agent-modal-backdrop" onClick={() => setIsApprovalModalOpen(false)}>
          <div className="agent-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="agent-modal-card__head">
              <div>
                <div className="agent-think-panel__label">等待确认</div>
                <div className="agent-think-panel__hint">{getDisplayApprovalAction(primaryApproval)}</div>
              </div>
              <span className={`agent-status-chip is-${primaryApproval.status}`}>{statusLabel(primaryApproval.status)}</span>
            </div>
            {approvalPreview ? <div className="agent-modal-card__preview">{approvalPreview}</div> : null}
            <pre className="agent-code-block">{JSON.stringify(primaryApproval.payload, null, 2)}</pre>
            <button
              type="button"
              className="agent-primary-action agent-modal-card__confirm"
              onClick={() => {
                setIsApprovalModalOpen(false);
                onApprove(primaryApproval.id);
              }}
              disabled={approvalPending}
            >
              确认并继续
            </button>
          </div>
        </div>
      ) : null}

      {completedSteps.length > 0 ? (
        <details className="agent-output-section">
          <summary className="agent-think-panel__summary">
            <div className="agent-think-panel__summary-main">
              <span className="agent-think-panel__label">执行结果</span>
              <span className="agent-think-panel__hint">{completedSteps.length} 项结果</span>
            </div>
            <div className="agent-think-panel__chips">
              <span className="agent-think-chip">{completedSteps.length} 个步骤</span>
            </div>
          </summary>
          <div className="mt-3 space-y-3">
            {completedSteps.map((item) => {
                const cards = getOutputCards(item);
                return (
                  <details key={item.id} className="agent-output-group">
                    <summary className="agent-think-panel__summary">
                      <div className="agent-think-panel__summary-main">
                        <span className="agent-think-panel__label">{getDisplayStepTitle(item)}</span>
                        <span className="agent-think-panel__hint">{summarizeOutputCards(cards)}</span>
                      </div>
                      <div className="agent-think-panel__chips">
                        <span className={`agent-status-chip is-${item.status}`}>{statusLabel(item.status)}</span>
                      </div>
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {cards.map((card) => (
                        <article
                          key={`${item.id}-${card.key}`}
                          className={`agent-output-card ${card.tone === "warning" ? "is-warning" : card.tone === "success" ? "is-success" : ""}`}
                        >
                          <div className="agent-output-label">{card.label}</div>
                          <pre className="agent-output-value">{card.value}</pre>
                        </article>
                      ))}
                    </div>
                  </details>
                );
              })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function ChatThread({
  activeConversationId,
  draftGoal,
  draftTaskType,
  onDraftGoalChange,
  onDraftTaskTypeChange,
  onConversationCreated,
}: ChatThreadProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [approvalError, setApprovalError] = useState("");
  const [liveGoalEvents, setLiveGoalEvents] = useState<Record<string, AgentTimelineEvent[]>>({});

  const patchGoalTimeline = (goalId: string, timeline: AgentGoalTimelineDto) => {
    queryClient.setQueryData<AgentConversationDto>(
      ["agent-conversations", activeConversationId, "detail"],
      (current) => {
        if (!current) return current;
        const assistantSummary =
          timeline.goal.status === "done"
            ? (() => {
                const llmStep = [...timeline.timeline].reverse().find((step) => step.kind === "llm" && step.status === "done");
                const output = llmStep?.output as { content?: string } | undefined;
                if (typeof output?.content === "string" && output.content.trim()) {
                  return output.content.trim().slice(0, 320);
                }
                const createPostStep = [...timeline.timeline].reverse().find((step) => step.step_key === "create_post" && step.status === "done");
                const input = createPostStep?.input as { content?: string; title?: string } | undefined;
                if (typeof input?.content === "string" && input.content.trim()) {
                  return input.content.trim().slice(0, 320);
                }
                if (typeof input?.title === "string" && input.title.trim()) {
                  return `${input.title.trim()} 已生成并保存为草稿。`;
                }
                return timeline.goal.summary;
              })()
            : timeline.goal.status === "waiting_approval"
              ? "我已生成正文草稿，等待你确认后再保存。"
              : timeline.goal.status === "failed"
                ? "执行中出现错误。你可以修正后继续执行剩余步骤。"
                : timeline.goal.summary;

        return {
          ...current,
          conversation: {
            ...current.conversation,
            status: timeline.goal.status || current.conversation.status,
            updated_at: new Date().toISOString(),
          },
          messages: current.messages.map((message) =>
            message.goal_id === goalId && message.role === "assistant"
              ? {
                  ...message,
                  content: assistantSummary || message.content,
                  meta: {
                    ...message.meta,
                    execution_stage: timeline.goal.status,
                    timeline_events: timeline.events || message.meta?.timeline_events || [],
                  },
                }
              : message
          ),
          goals: current.goals.map((item) => (item.goal.id === goalId ? timeline : item)),
        };
      }
    );
  };

  const conversationQuery = useQuery({
    queryKey: ["agent-conversations", activeConversationId, "detail"],
    queryFn: async () => get<AgentConversationDto>(getVersionedApiPath(`/agent/conversations/${activeConversationId}`)),
    enabled: isAuthenticated && !!activeConversationId,
    refetchInterval: (query) => {
      if (!query.state.data) return false;
      const hasActiveGoal = query.state.data.goals.some((goal) => goal.goal.status !== "done" && goal.goal.status !== "failed");
      return hasActiveGoal ? 2000 : false;
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ approvalId, action, goalId }: { approvalId: number; action: "approve" | "reject"; goalId: string }) => {
      const approvalResult = await post<{ timeline_event?: AgentTimelineEvent }>(getVersionedApiPath(`/agent/approvals/${approvalId}/${action}`));
      if (approvalResult.timeline_event) {
        setLiveGoalEvents((current) => ({
          ...current,
          [goalId]: [...(current[goalId] || []), approvalResult.timeline_event!],
        }));
      }
      if (action === "approve") {
        const response = await fetch(getVersionedApiPath(`/agent/goals/${goalId}/execute/stream`), {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok || !response.body) {
          throw new Error(`goal_execute_stream_failed:${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const payload = JSON.parse(trimmed) as
              | { type: "timeline"; event: AgentTimelineEvent }
              | { type: "done"; timeline: AgentGoalTimelineDto }
              | { type: "error"; message: string };

            if (payload.type === "timeline") {
              setLiveGoalEvents((current) => ({
                ...current,
                [goalId]: [...(current[goalId] || []), payload.event],
              }));
              continue;
            }

            if (payload.type === "done") {
              patchGoalTimeline(goalId, payload.timeline);
              continue;
            }

            if (payload.type === "error") {
              throw new Error(payload.message || "goal_execute_stream_failed");
            }
          }

          if (done) break;
        }
      }
    },
    onSuccess: () => {
      setApprovalError("");
    },
    onError: (error) => {
      setApprovalError(getErrorMessage(error));
    },
  });

  useEffect(() => {
    if (!activeConversationId) {
      threadRef.current?.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    if (conversationQuery.data) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [activeConversationId, conversationQuery.data]);

  const goalMap = useMemo(() => {
    const map = new Map<string, AgentGoalTimelineDto>();
    for (const goal of conversationQuery.data?.goals || []) {
      map.set(goal.goal.id, goal);
    }
    return map;
  }, [conversationQuery.data]);

  const applySuggestion = (prompt: string, taskType: string) => {
    onDraftGoalChange(prompt);
    onDraftTaskTypeChange(taskType);
  };

  const renderMessageContent = (message: AgentConversationMessage) => {
    if (message.role === "assistant" && (message.local_status === "pending" || message.local_status === "streaming") && !message.content) {
      return null;
    }
    return <div className="agent-answer-card">{message.content}</div>;
  };

  return (
    <>
      <div ref={threadRef} className="agent-chat-thread custom-scrollbar">
        <div className="agent-chat-container">
          {!activeConversationId ? (
            <div className="agent-welcome">
              <div className="agent-capability-note">
                当前支持文章规划、草稿生成、博客草稿保存。视频仅生成脚本和提示词，暂不调用视频生成接口。
              </div>
              <div className="agent-welcome-logo">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1>今天要让 Agent 帮你完成什么内容任务？</h1>
              <div className="agent-suggestion-grid">
                {SUGGESTIONS.map((item) => (
                  <button key={item.title} type="button" className="agent-suggestion-card" onClick={() => applySuggestion(item.prompt, item.taskType)}>
                    <h4>
                      <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      {item.title}
                    </h4>
                    <p>{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : conversationQuery.isLoading ? (
            <div className="py-20 text-center text-zinc-500">正在获取对话上下文...</div>
          ) : conversationQuery.data ? (
            <div className="space-y-6">
              <div className="agent-capability-note">
                当前支持文章规划、草稿生成、博客草稿保存。视频仅生成脚本和提示词，暂不调用视频生成接口。
              </div>
              {conversationQuery.data.messages.map((message) => {
                const linkedGoal = message.goal_id ? goalMap.get(message.goal_id) : null;
                return (
                  <div key={message.id} className={`agent-message ${message.role === "user" ? "user" : "ai"}`}>
                    <div className={`agent-avatar ${message.role === "user" ? "user" : "ai"}`}>
                      {message.role === "user" ? (
                        <svg className="h-5 w-5 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="agent-bubble space-y-4">
                      {renderMessageContent(message)}
                      {message.role === "assistant" ? (
                        <ThinkPanel
                          message={message}
                          linkedGoal={linkedGoal}
                          conversationMemory={conversationQuery.data.conversation_memory}
                          longTermMemories={conversationQuery.data.long_term_memories || []}
                        />
                      ) : null}
                      {linkedGoal && message.role === "assistant" ? (
                        <GoalThreadBlock
                          goalTimeline={linkedGoal}
                          liveEvents={liveGoalEvents[linkedGoal.goal.id] || []}
                          approvalError={approvalError}
                          onApprove={(approvalId) => approvalMutation.mutate({ approvalId, action: "approve", goalId: linkedGoal.goal.id })}
                          approvalPending={approvalMutation.isPending}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-zinc-500">会话不存在或已被删除。</div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput
        conversationId={activeConversationId}
        onConversationReady={onConversationCreated}
        goal={draftGoal}
        taskType={draftTaskType}
        onGoalChange={onDraftGoalChange}
        onTaskTypeChange={onDraftTaskTypeChange}
        disabled={conversationQuery.isFetching && !!activeConversationId}
      />
    </>
  );
}
