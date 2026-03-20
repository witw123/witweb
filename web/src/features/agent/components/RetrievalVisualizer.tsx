import Link from "next/link";
import type { AgentRetrievalHit } from "@/features/agent/types";
import { formatRetrievalScore, truncateContent, getRetrievalSourceIcon } from "./agent-utils";

interface RetrievalVisualizerProps {
  hits: AgentRetrievalHit[];
  isLive?: boolean;  // 是否为实时流式显示
}

function RetrievalHitCard({ hit, isLive }: { hit: AgentRetrievalHit; isLive?: boolean }) {
  const icon = getRetrievalSourceIcon(hit.source_type);

  return (
    <div className={`rounded-xl bg-white/5 p-3 transition-all ${isLive ? "animate-pulse-once" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div className="min-w-0">
            <div className="truncate font-medium text-white text-sm">
              {hit.href ? (
                <Link
                  href={hit.href}
                  className="text-sky-300 transition hover:text-sky-200 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {hit.title}
                </Link>
              ) : (
                <span className="text-white">{hit.title}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-zinc-500">
                {hit.source_type || "文档"}
              </span>
              {hit.score !== undefined && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-xs text-zinc-500">
                    相关度 {formatRetrievalScore(hit.score)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {isLive && (
          <span className="flex-shrink-0 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
            NEW
          </span>
        )}
      </div>

      {hit.content_preview && (
        <div className="mt-2 rounded-lg bg-black/20 p-2 text-xs text-zinc-400 leading-relaxed">
          {truncateContent(hit.content_preview, 200)}
        </div>
      )}
    </div>
  );
}

export function RetrievalVisualizer({ hits, isLive }: RetrievalVisualizerProps) {
  if (!hits || hits.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          检索结果 ({hits.length})
        </span>
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-sky-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            实时检索中
          </span>
        )}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {hits.slice(0, 5).map((hit) => (
          <RetrievalHitCard key={`${hit.document_id}-${hit.chunk_index}`} hit={hit} isLive={isLive} />
        ))}
        {hits.length > 5 && (
          <div className="text-center text-xs text-zinc-500 py-1">
            还有 {hits.length - 5} 条结果...
          </div>
        )}
      </div>
    </div>
  );
}
