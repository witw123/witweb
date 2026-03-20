import type { AgentTokenCount } from "@/features/agent/types";
import { formatTokenBreakdown } from "./agent-utils";

interface TokenCounterProps {
  tokens?: AgentTokenCount;
  isStreaming?: boolean;
}

export function TokenCounter({ tokens, isStreaming }: TokenCounterProps) {
  if (!tokens) return null;

  const { input, output, total } = formatTokenBreakdown(tokens);

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-500">输入:</span>
        <span className="font-medium text-zinc-300">{input}</span>
      </div>
      <div className="h-3 w-px bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-500">输出:</span>
        <span className="font-medium text-zinc-300">{output}</span>
      </div>
      <div className="h-3 w-px bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-500">总计:</span>
        <span className={`font-medium ${isStreaming ? "text-sky-400" : "text-emerald-400"}`}>
          {total}
          {isStreaming && (
            <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
          )}
        </span>
      </div>
    </div>
  );
}
