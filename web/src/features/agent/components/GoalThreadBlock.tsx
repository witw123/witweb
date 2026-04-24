import { useState } from "react";
import type { AgentGoalTimelineDto } from "@/features/agent/types";
import type { AgentTimelineEvent } from "@/features/agent/timeline";

interface GoalThreadBlockProps {
  goalTimeline: AgentGoalTimelineDto;
  approvalError: string;
  onApprove: (approvalId: number) => void;
  onReject: (approvalId: number) => void;
  approvalPending: boolean;
  liveEvents?: AgentTimelineEvent[];
}

function getStepOutputSummary(output: unknown): string | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const obj = output as Record<string, unknown>;
  if (typeof obj.title === "string" && obj.title) return obj.title;
  if (typeof obj.seo_title === "string" && obj.seo_title) return obj.seo_title;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getApprovalPayloadSummary(payload: unknown) {
  const obj = asRecord(payload);
  if (!obj) return null;

  const title = readString(obj.title);
  const excerpt = readString(obj.excerpt);
  const tags = readString(obj.tags);
  const status = readString(obj.status);
  const content = readString(obj.content);

  return {
    title,
    excerpt,
    tags,
    status,
    contentPreview: content.length > 260 ? `${content.slice(0, 260)}...` : content,
  };
}

function eventLabel(event: AgentTimelineEvent) {
  if (event.kind === "tool_start") return "工具开始";
  if (event.kind === "tool_result") return "工具结果";
  if (event.kind === "artifact") return "生成产物";
  if (event.kind === "approval") return "审批";
  if (event.kind === "goal_status") return "任务状态";
  return event.title;
}

export function GoalThreadBlock({
  goalTimeline,
  approvalError,
  onApprove,
  onReject,
  approvalPending,
  liveEvents = [],
}: GoalThreadBlockProps) {
  const pendingApprovals = goalTimeline.approvals.filter(a => a.status === "pending");
  const visibleSteps = goalTimeline.timeline.filter(t => t.status !== "planned" || goalTimeline.goal.status !== "done");
  const completedSteps = visibleSteps.filter(t => t.status === "done" || t.status === "failed");
  const isActive = goalTimeline.goal.status !== "done" && goalTimeline.goal.status !== "failed";

  const [isExpanded, setIsExpanded] = useState(false);

  // Get summary from first completed step with output
  const stepWithOutput = completedSteps.find(s => s.output);
  const outputSummary = stepWithOutput ? getStepOutputSummary(stepWithOutput.output) : null;

  // Show minimal indicator if active or has pending approvals
  if (!isActive && completedSteps.length === 0 && pendingApprovals.length === 0 && liveEvents.length === 0) return null;

  return (
    <div className="border border-white/5 rounded-xl bg-[#0f172a]/40 overflow-hidden my-2">
      {/* 简洁状态栏 */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-300 transition-colors duration-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            goalTimeline.goal.status === "done" ? "bg-emerald-500" :
            goalTimeline.goal.status === "failed" ? "bg-red-500" :
            pendingApprovals.length > 0 ? "bg-amber-500 animate-pulse" :
            "bg-sky-500 animate-pulse"
          }`} />
          <span className="text-sm font-medium text-white">
            {pendingApprovals.length > 0
              ? `等待确认 (${pendingApprovals.length})`
              : goalTimeline.goal.status === "done"
                ? "任务完成"
                : goalTimeline.goal.status === "failed"
                  ? "任务失败"
                  : isActive
                    ? "执行中..."
                    : "任务已结束"
            }
          </span>
        </div>
        <div className="flex items-center gap-3">
          {outputSummary && (
            <span className="text-xs text-zinc-500 truncate max-w-[150px]">{outputSummary}</span>
          )}
          <span className="text-zinc-500 text-xs">{isExpanded ? "收起任务详情" : "查看任务详情"}</span>
        </div>
      </button>

      {/* 展开的详情及审批 */}
      {isExpanded && (
        <div className="border-t border-white/5 bg-black/20 pt-3 pb-1">
          {/* 审批卡片 */}
          {pendingApprovals.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              {pendingApprovals.map(approval => {
                const payloadSummary = getApprovalPayloadSummary(approval.payload);
                return (
                  <div key={approval.id} className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-amber-300">
                        {approval.action === "blog.create_post" ? "保存博客草稿" :
                         approval.action === "video.generate" ? "生成视频" :
                         approval.action}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                          onClick={() => onReject(approval.id)}
                          disabled={approvalPending}
                        >
                          拒绝
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                          onClick={() => onApprove(approval.id)}
                          disabled={approvalPending}
                        >
                          确认
                        </button>
                      </div>
                    </div>
                    {payloadSummary && (
                      <div className="mt-3 space-y-2 rounded-lg bg-black/20 p-3 text-xs text-zinc-300">
                        {payloadSummary.title && (
                          <div>
                            <span className="text-zinc-500">标题：</span>
                            <span>{payloadSummary.title}</span>
                          </div>
                        )}
                        {payloadSummary.excerpt && (
                          <div>
                            <span className="text-zinc-500">摘要：</span>
                            <span>{payloadSummary.excerpt}</span>
                          </div>
                        )}
                        {payloadSummary.tags && (
                          <div>
                            <span className="text-zinc-500">标签：</span>
                            <span>{payloadSummary.tags}</span>
                          </div>
                        )}
                        {payloadSummary.status && (
                          <div>
                            <span className="text-zinc-500">状态：</span>
                            <span>{payloadSummary.status}</span>
                          </div>
                        )}
                        {payloadSummary.contentPreview && (
                          <div className="leading-relaxed text-zinc-400">
                            <span className="text-zinc-500">正文预览：</span>
                            <span>{payloadSummary.contentPreview}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {approvalError && (
                      <div className="mt-2 text-xs text-red-400">{approvalError}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 执行步骤 */}
          {visibleSteps.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">执行步骤</span>
              {visibleSteps.map(step => {
                const summary = getStepOutputSummary(step.output);
                return (
                  <div key={step.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                    <span className={`mt-0.5 text-xs ${
                      step.status === "done" ? "text-emerald-400" :
                      step.status === "failed" ? "text-red-400" :
                      step.status === "running" ? "text-sky-400" :
                      step.status === "skipped_waiting_approval" ? "text-amber-400" :
                      "text-zinc-500"
                    }`}>
                      {step.status === "done" ? "✓" :
                       step.status === "failed" ? "✗" :
                       step.status === "running" ? "…" :
                       step.status === "skipped_waiting_approval" ? "!" :
                       "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{step.title}</div>
                      {summary && (
                        <div className="text-xs text-zinc-500 truncate mt-0.5">{summary}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {liveEvents.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">实时事件</span>
              {liveEvents.slice(-8).map((event) => (
                <div key={event.id} className="rounded-lg bg-sky-500/5 border border-sky-500/10 p-2 text-xs text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sky-300">{eventLabel(event)}</span>
                    <span className="text-zinc-500">{event.status}</span>
                  </div>
                  <div className="mt-1 truncate text-zinc-400">
                    {event.detail || event.output_preview || event.input_preview || event.artifact_preview || event.title}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
