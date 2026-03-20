import Link from "next/link";
import type { AgentCitation } from "@/features/agent/types";

interface CitationListProps {
  citations: AgentCitation[];
}

export function CitationList({ citations }: CitationListProps) {
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
