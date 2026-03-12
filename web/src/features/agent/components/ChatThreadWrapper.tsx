"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import type { AgentConversationDto } from "@/features/agent/types";
import { ChatThread } from "./ChatThread";

function ChatThreadInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeConversationId = searchParams.get("conversationId");
  const legacyGoalId = searchParams.get("goalId");
  const [draftGoal, setDraftGoal] = useState("");
  const [draftTaskType, setDraftTaskType] = useState("hot_topic_article");

  const legacyConversationQuery = useQuery({
    queryKey: ["agent-goals", legacyGoalId, "conversation-compat"],
    queryFn: async () => get<AgentConversationDto>(getVersionedApiPath(`/agent/conversations/by-goal/${legacyGoalId}`)),
    enabled: !activeConversationId && !!legacyGoalId,
  });

  useEffect(() => {
    if (legacyConversationQuery.data?.conversation.id && !activeConversationId) {
      router.replace(`/agent?conversationId=${legacyConversationQuery.data.conversation.id}`);
    }
  }, [activeConversationId, legacyConversationQuery.data, router]);

  if (!activeConversationId && legacyGoalId && legacyConversationQuery.isLoading) {
    return <div className="flex flex-1 items-center justify-center text-zinc-500">正在迁移旧会话...</div>;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-safe">
      <ChatThread
        activeConversationId={activeConversationId}
        draftGoal={draftGoal}
        draftTaskType={draftTaskType}
        onDraftGoalChange={setDraftGoal}
        onDraftTaskTypeChange={setDraftTaskType}
        onConversationCreated={(newConversationId) => {
          setDraftGoal("");
          router.push(`/agent?conversationId=${newConversationId}`);
        }}
      />
    </div>
  );
}

export function ChatThreadWrapper() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-zinc-500">加载会话中...</div>}>
      <ChatThreadInner />
    </Suspense>
  );
}
