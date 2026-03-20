import type { AgentConversationDto } from "@/features/agent/types";

interface LongTermMemoryBlockProps {
  memories: NonNullable<AgentConversationDto["long_term_memories"]>;
}

export function LongTermMemoryBlock({ memories }: LongTermMemoryBlockProps) {
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
