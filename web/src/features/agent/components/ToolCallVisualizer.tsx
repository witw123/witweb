import type { AgentTimelineEvent } from "@/features/agent/timeline";
import { getToolDisplayName, statusLabel } from "./agent-utils";

interface ToolCallVisualizerProps {
  toolCalls?: Array<{
    tool_name: string;
    status: "started" | "completed" | "failed";
    started_at: string;
    completed_at?: string;
    result_preview?: string;
  }>;
  timelineEvents?: AgentTimelineEvent[];
  isLive?: boolean;
}

const TOOL_STATUS_ICONS: Record<string, string> = {
  started: "⚡",
  completed: "✅",
  failed: "❌",
  running: "🔄",
};

export function ToolCallVisualizer({ toolCalls, timelineEvents, isLive }: ToolCallVisualizerProps) {
  // 优先使用传入的 toolCalls，否则从 timelineEvents 构建
  const events = toolCalls?.map((call) => ({
    id: call.started_at,
    tool_name: call.tool_name,
    status: call.status,
    result_preview: call.result_preview,
  })) || [];

  // 从 timeline events 中提取工具调用
  const toolEvents = timelineEvents?.filter(
    (e) => e.kind === "tool_start" || e.kind === "tool_result"
  ) || [];

  if (events.length === 0 && toolEvents.length === 0) return null;

  const hasLiveTools = isLive && events.some((e) => e.status === "started");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          工具执行 {events.length > 0 ? `(${events.length})` : `(${toolEvents.length})`}
        </span>
        {hasLiveTools && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            执行中
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {events.map((event, index) => (
          <div
            key={`tool-${event.id}-${index}`}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
              event.status === "started"
                ? "bg-amber-500/10 border border-amber-500/20"
                : event.status === "completed"
                  ? "bg-emerald-500/5 border border-emerald-500/10"
                  : event.status === "failed"
                    ? "bg-red-500/5 border border-red-500/10"
                    : "bg-white/5"
            }`}
          >
            <span className="text-sm">{TOOL_STATUS_ICONS[event.status] || "🔧"}</span>
            <span className={`flex-1 ${event.status === "started" ? "text-amber-300" : "text-zinc-300"}`}>
              {getToolDisplayName(event.tool_name)}
            </span>
            <span className={`text-[10px] ${
              event.status === "started"
                ? "text-amber-400"
                : event.status === "completed"
                  ? "text-emerald-400"
                  : event.status === "failed"
                    ? "text-red-400"
                    : "text-zinc-500"
            }`}>
              {statusLabel(event.status)}
            </span>
          </div>
        ))}

        {toolEvents.map((event, index) => {
          const isRunning = event.status === "running" || event.kind === "tool_start";
          return (
            <div
              key={`timeline-tool-${event.id || index}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
                isRunning
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-white/5"
              }`}
            >
              <span className="text-sm">{isRunning ? "🔄" : "✅"}</span>
              <span className={`flex-1 ${isRunning ? "text-amber-300" : "text-zinc-300"}`}>
                {getToolDisplayName(event.tool_name || event.title)}
              </span>
              {event.output_preview && (
                <span className="max-w-[120px] truncate text-zinc-500" title={event.output_preview}>
                  {event.output_preview.slice(0, 30)}...
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
