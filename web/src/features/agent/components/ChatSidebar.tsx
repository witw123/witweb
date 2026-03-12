"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { del, get, post } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import type { AgentConversationDto, AgentConversationSummary } from "@/features/agent/types";

interface ChatSidebarProps {
  onCloseMobile: () => void;
  isOpen?: boolean;
}

const TEXT = {
  newConversation: "\u5f00\u542f\u65b0\u5bf9\u8bdd",
  navTitle: "\u5de5\u5177\u4e0e\u8bbe\u7f6e",
  historyTitle: "\u804a\u5929\u5386\u53f2",
  loading: "\u52a0\u8f7d\u4e2d...",
  empty: "\u6682\u65e0\u5386\u53f2\u8bb0\u5f55",
  untitled: "\u672a\u547d\u540d\u5bf9\u8bdd",
  delete: "\u5220\u9664\u4f1a\u8bdd",
  deleteConfirm: "\u786e\u8ba4\u5220\u9664\u8fd9\u6bb5\u5bf9\u8bdd\u5417\uff1f\u5220\u9664\u540e\u65e0\u6cd5\u6062\u590d\u3002",
  sidebarLoading: "\u52a0\u8f7d\u4fa7\u8fb9\u680f...",
  newConversationShort: "\u65b0\u5bf9\u8bdd",
};

const NAV_ITEMS = [
  {
    href: "/agent/assistants",
    label: "\u52a9\u624b\u9ad8\u7ea7\u8bbe\u7f6e",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/agent/prompts",
    label: "Prompt \u6279\u91cf\u6d4b\u8bd5",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    href: "/agent/knowledge",
    label: "\u79c1\u5e93\u6587\u6863\u7ba1\u7406",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/agent/gallery",
    label: "\u5386\u53f2\u4f5c\u54c1\u9648\u5217",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
] as const;

function buildAgentHref(path: string, conversationId?: string | null) {
  return conversationId ? `${path}?conversationId=${conversationId}` : path;
}

function formatUpdatedAt(input: string) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function SidebarInner({ onCloseMobile }: { onCloseMobile: () => void }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeConversationId = searchParams.get("conversationId");

  const conversationsQuery = useQuery({
    queryKey: ["agent-conversations"],
    queryFn: async () => {
      const result = await get<{ items: AgentConversationSummary[] }>(getVersionedApiPath("/agent/conversations"));
      return Array.isArray(result.items) ? result.items : [];
    },
    enabled: isAuthenticated,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => post<AgentConversationDto>(getVersionedApiPath("/agent/conversations"), { title: TEXT.newConversationShort }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
      router.push(`/agent?conversationId=${data.conversation.id}`);
      onCloseMobile();
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await del(getVersionedApiPath(`/agent/conversations/${conversationId}`));
      return conversationId;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["agent-conversations"] });
      const previousConversations = queryClient.getQueryData<AgentConversationSummary[]>(["agent-conversations"]);

      queryClient.setQueryData<AgentConversationSummary[]>(["agent-conversations"], (old) =>
        old?.filter((item) => item.id !== deletedId) || []
      );
      queryClient.removeQueries({ queryKey: ["agent-conversations", deletedId, "detail"] });

      if (activeConversationId === deletedId) {
        router.replace("/agent");
      }

      return { previousConversations };
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
      queryClient.removeQueries({ queryKey: ["agent-conversations", deletedId, "detail"] });
    },
    onError: (_error, deletedId, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(["agent-conversations"], context.previousConversations);
      }
      if (activeConversationId === deletedId) {
        router.replace(`/agent?conversationId=${deletedId}`);
      }
    },
    onSettled: (_data, _error, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
      if (deletedId) {
        queryClient.invalidateQueries({ queryKey: ["agent-conversations", deletedId, "detail"] });
      }
    },
  });

  const conversations = conversationsQuery.data || [];

  return (
    <>
      <div className="agent-chat-sidebar-header">
        <button
          className="agent-new-chat-btn"
          onClick={() => createConversationMutation.mutate()}
          disabled={!isAuthenticated || createConversationMutation.isPending}
          type="button"
        >
          <span className="agent-new-chat-icon">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          <span className="agent-new-chat-text">{TEXT.newConversation}</span>
        </button>
      </div>

      <div className="agent-sidebar-section">
        <div className="agent-sidebar-section-title">{TEXT.navTitle}</div>
        <nav className="agent-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const targetHref = buildAgentHref(item.href, activeConversationId);
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={targetHref}
                onClick={onCloseMobile}
                className={`agent-sidebar-link ${isActive ? "is-active" : ""}`}
              >
                <span className="agent-sidebar-link-icon">{item.icon}</span>
                <span className="agent-sidebar-link-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="agent-sidebar-divider" />

      <div className="agent-chat-history custom-scrollbar">
        <div className="agent-sidebar-section-title">{TEXT.historyTitle}</div>

        {conversationsQuery.isLoading ? (
          <div className="agent-sidebar-empty">{TEXT.loading}</div>
        ) : conversations.length === 0 ? (
          <div className="agent-sidebar-empty">{TEXT.empty}</div>
        ) : (
          <div className="agent-conversation-list">
            {conversations.map((conversation) => {
              const isActive = pathname === "/agent" && activeConversationId === conversation.id;
              return (
                <div
                  key={conversation.id}
                  className={`agent-conversation-item ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    router.push(`/agent?conversationId=${conversation.id}`);
                    onCloseMobile();
                  }}
                >
                  <div className="agent-conversation-main">
                    <div className="agent-conversation-topline">
                      <div className="agent-conversation-title" title={conversation.title}>
                        {conversation.title || TEXT.untitled}
                      </div>
                      <div className="agent-conversation-time">{formatUpdatedAt(conversation.updated_at)}</div>
                    </div>

                    {conversation.last_message_preview ? (
                      <div className="agent-conversation-preview" title={conversation.last_message_preview}>
                        {conversation.last_message_preview}
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="agent-conversation-delete"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (deleteConversationMutation.isPending) return;
                      if (!window.confirm(TEXT.deleteConfirm)) return;
                      deleteConversationMutation.mutate(conversation.id);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    title={TEXT.delete}
                    aria-label={TEXT.delete}
                    disabled={deleteConversationMutation.isPending}
                    type="button"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export function ChatSidebar({ onCloseMobile, isOpen }: ChatSidebarProps) {
  return (
    <aside className={`agent-chat-sidebar ${isOpen ? "open" : ""}`}>
      <Suspense fallback={<div className="p-4 text-zinc-400">{TEXT.sidebarLoading}</div>}>
        <SidebarInner onCloseMobile={onCloseMobile} />
      </Suspense>
    </aside>
  );
}
