import { useState, useMemo } from "react";
import type { AgentGoalTimelineDto } from "@/features/agent/types";

interface GoalThreadBlockProps {
  goalTimeline: AgentGoalTimelineDto;
  approvalError: string;
  onApprove: (approvalId: number) => void;
  approvalPending: boolean;
}

function getStepOutputSummary(output: unknown): string | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const obj = output as Record<string, unknown>;
  if (typeof obj.title === "string" && obj.title) return obj.title;
  if (typeof obj.seo_title === "string" && obj.seo_title) return obj.seo_title;
  return null;
}

export function GoalThreadBlock({ goalTimeline, approvalError, onApprove, approvalPending }: GoalThreadBlockProps) {
  const pendingApprovals = goalTimeline.approvals.filter(a => a.status === "pending");
  const completedSteps = goalTimeline.timeline.filter(t => t.status === "done" || t.status === "failed");
  const isActive = goalTimeline.goal.status !== "done" && goalTimeline.goal.status !== "failed";

  const [isExpanded, setIsExpanded] = useState(false);

  // Get summary from first completed step with output
  const outputSummary = useMemo(() => {
    const stepWithOutput = completedSteps.find(s => s.output);
    return stepWithOutput ? getStepOutputSummary(stepWithOutput.output) : null;
  }, [completedSteps]);

  // Show minimal indicator if active or has pending approvals
  if (!isActive && completedSteps.length === 0 && pendingApprovals.length === 0) return null;

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
              {pendingApprovals.map(approval => (
                <div key={approval.id} className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-amber-300">
                      {approval.action === "blog.create_post" ? "保存博客草稿" :
                       approval.action === "video.generate" ? "生成视频" :
                       approval.action}
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                      onClick={() => onApprove(approval.id)}
                      disabled={approvalPending}
                    >
                      确认
                    </button>
                  </div>
                  {approvalError && (
                    <div className="mt-2 text-xs text-red-400">{approvalError}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 执行结果 */}
          {completedSteps.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">执行结果</span>
              {completedSteps.map(step => {
                const summary = getStepOutputSummary(step.output);
                return (
                  <div key={step.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                    <span className={`mt-0.5 text-xs ${step.status === "done" ? "text-emerald-400" : "text-red-400"}`}>
                      {step.status === "done" ? "✓" : "✗"}
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
        </div>
      )}
    </div>
  );
}
