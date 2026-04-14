"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get, getErrorMessage, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import type {
  AgentConversationDto,
  AgentConversationMessage,
  AgentGoalTimelineDto,
  MarkdownCodeProps,
} from "@/features/agent/types";
import { ChatInput } from "./ChatInput";
import { ThinkPanel } from "./ThinkPanel";
import { GoalThreadBlock } from "./GoalThreadBlock";
import { MessageAttachmentList } from "./MessageAttachmentList";
import { AgentWorkbench } from "./AgentWorkbench";
import { MarkdownRenderer } from "./MarkdownRenderer";

export interface ActiveArtifact {
  id: string;
  title: string;
  content: string;
  language?: string;
}

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

function getMessageAttachments(message: AgentConversationMessage) {
  return Array.isArray(message.meta?.attachments) ? message.meta.attachments : [];
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
  const [, setLiveGoalEvents] = useState<Record<string, import("@/features/agent/timeline").AgentTimelineEvent[]>>({});
  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifact | null>(null);

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
                  return output.content.trim();
                }
                const createPostStep = [...timeline.timeline].reverse().find((step) => step.step_key === "create_post" && step.status === "done");
                const input = createPostStep?.input as { content?: string; title?: string } | undefined;
                if (typeof input?.content === "string" && input.content.trim()) {
                  return input.content.trim();
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
      const approvalResult = await post<{ timeline_event?: import("@/features/agent/timeline").AgentTimelineEvent }>(
        getVersionedApiPath(`/agent/approvals/${approvalId}/${action}`)
      );
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
              | { type: "goal_status"; event: import("@/features/agent/timeline").AgentTimelineEvent }
              | { type: "tool_start"; event: import("@/features/agent/timeline").AgentTimelineEvent }
              | { type: "tool_result"; event: import("@/features/agent/timeline").AgentTimelineEvent }
              | { type: "artifact"; event: import("@/features/agent/timeline").AgentTimelineEvent }
              | { type: "timeline"; event: import("@/features/agent/timeline").AgentTimelineEvent }
              | { type: "done"; timeline: AgentGoalTimelineDto }
              | { type: "error"; message: string };

            if (
              payload.type === "timeline" ||
              payload.type === "goal_status" ||
              payload.type === "tool_start" ||
              payload.type === "tool_result" ||
              payload.type === "artifact"
            ) {
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
  }, [conversationQuery.data?.goals]);

  const applySuggestion = (prompt: string, taskType: string) => {
    onDraftGoalChange(prompt);
    onDraftTaskTypeChange(taskType);
  };

  const renderMessageContent = (message: AgentConversationMessage) => {
    const attachments = getMessageAttachments(message);
    const hasContent = Boolean(message.content?.trim());

    if (message.role === "assistant" && (message.local_status === "pending" || message.local_status === "streaming") && !hasContent) {
      return null;
    }

    if (!hasContent && attachments.length === 0) {
      return null;
    }

    const renderCodeBlock = ({ inline, className, children, ...props }: MarkdownCodeProps) => {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";
      const isBlock = !inline && children;
      
      const contentStr = String(children).replace(/\n$/, "");
      
      // Only intercept big blocks or specific programming languages / markups that feel like "Artifacts"
      if (isBlock && (language === "markdown" || language === "html" || language === "react" || contentStr.length > 250)) {
        const title = language ? `${language.toUpperCase()} 文档/代码` : "生成的内容产物";
        const artifactId = `art-${contentStr.length}-${Date.now()}`;

        return (
          <div className="my-4 p-4 border border-blue-500/20 bg-blue-500/5 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 p-2 bg-blue-500/10 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-zinc-200 truncate">{title}</span>
                <span className="text-xs text-zinc-500 shrink-0">{contentStr.length} 字符可供预览或复制</span>
              </div>
            </div>
            <button
              onClick={() => setActiveArtifact({ id: artifactId, title, content: contentStr, language })}
              className="shrink-0 ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              在工作台展开
            </button>
          </div>
        );
      }

      // Default rendering for small inline limits
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    };

    return (
      <>
        {hasContent ? (
          <div className="agent-answer-card">
            <MarkdownRenderer content={message.content} components={{ code: renderCodeBlock }} />
          </div>
        ) : null}
        <MessageAttachmentList attachments={attachments} />
      </>
    );
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0 w-full relative">
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        <div ref={threadRef} className="agent-chat-thread custom-scrollbar flex-1">
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
                    <div className="agent-bubble space-y-3">
                      {message.role === "assistant" && message.local_status === "streaming" ? (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{animationDelay: "0ms"}} />
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{animationDelay: "150ms"}} />
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{animationDelay: "300ms"}} />
                          </div>
                          <span className="text-xs text-zinc-500">Agent 正在思考...</span>
                        </div>
                      ) : (
                        renderMessageContent(message)
                      )}
                      {message.role === "assistant" && (
                        <>
                          <ThinkPanel
                            message={message}
                            linkedGoal={linkedGoal}
                            conversationMemory={conversationQuery.data.conversation_memory}
                            longTermMemories={conversationQuery.data.long_term_memories || []}
                          />
                          {linkedGoal && (
                            <GoalThreadBlock
                              goalTimeline={linkedGoal}
                              approvalError={approvalError}
                              onApprove={(approvalId) => approvalMutation.mutate({ approvalId, action: "approve", goalId: linkedGoal.goal.id })}
                              approvalPending={approvalMutation.isPending}
                            />
                          )}
                        </>
                      )}
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
      </div>

      {activeArtifact && (
        <div className="pointer-events-none absolute inset-0 z-50 md:pointer-events-auto md:relative md:z-auto flex shrink-0">
          <div
            className="md:hidden absolute inset-0 bg-black/50 pointer-events-auto"
            onClick={() => setActiveArtifact(null)}
          />
          <div className="pointer-events-auto relative w-full md:w-auto h-full flex pt-[60px] md:pt-0">
            <AgentWorkbench
              artifact={activeArtifact}
              onClose={() => setActiveArtifact(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
