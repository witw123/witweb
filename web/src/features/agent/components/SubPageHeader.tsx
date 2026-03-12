"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import type { AgentConversationSummary } from "@/features/agent/types";

interface SubPageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

function buildMainThreadHref(conversationId?: string | null) {
  return conversationId ? `/agent?conversationId=${conversationId}` : "/agent";
}

export function SubPageHeader({ title, description, action }: SubPageHeaderProps) {
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const currentConversationId = searchParams.get("conversationId");

  const conversationsQuery = useQuery({
    queryKey: ["agent-conversations", "return-target"],
    queryFn: async () => {
      const result = await get<{ items: AgentConversationSummary[] }>(getVersionedApiPath("/agent/conversations"));
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated && !currentConversationId,
    staleTime: 30_000,
  });

  const fallbackConversationId = conversationsQuery.data?.[0]?.id || null;
  const returnHref = buildMainThreadHref(currentConversationId || fallbackConversationId);

  return (
    <div className="mb-6 border-b border-white/10 pb-5">
      <Link
        href={returnHref}
        className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        返回主对话流
      </Link>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
