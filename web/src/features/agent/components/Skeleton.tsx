"use client";

import { cn } from "@/lib/utils/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse bg-white/10 rounded", className)} />;
}

// Message skeleton for loading states
interface MessageSkeletonProps {
  role: "user" | "assistant";
  className?: string;
}

export function MessageSkeleton({ role, className }: MessageSkeletonProps) {
  return (
    <div className={cn("agent-message", role === "user" ? "user" : "ai", className)}>
      <div className={cn("agent-avatar", role === "user" ? "user" : "ai")}>
        <Skeleton className="w-full h-full rounded-full" />
      </div>
      <div className="agent-bubble">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          {role === "assistant" && <Skeleton className="h-4 w-2/3" />}
        </div>
      </div>
    </div>
  );
}

// Conversation list skeleton
interface ConversationListSkeletonProps {
  count?: number;
  className?: string;
}

export function ConversationListSkeleton({ count = 3, className }: ConversationListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="agent-conversation-item">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Think panel skeleton
interface ThinkPanelSkeletonProps {
  className?: string;
}

export function ThinkPanelSkeleton({ className }: ThinkPanelSkeletonProps) {
  return (
    <div className={cn("agent-think-panel", className)}>
      <div className="agent-think-shell">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="agent-think-shell__step">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Full chat loading skeleton
interface ChatLoadingSkeletonProps {
  messageCount?: number;
  className?: string;
}

export function ChatLoadingSkeleton({ messageCount = 2, className }: ChatLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: messageCount }).map((_, i) => (
        <MessageSkeleton key={i} role={i % 2 === 0 ? "user" : "assistant"} />
      ))}
    </div>
  );
}

// Welcome screen skeleton (for initial load)
export function WelcomeSkeleton() {
  return (
    <div className="agent-welcome">
      <div className="agent-welcome-logo">
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <div className="agent-suggestion-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="agent-suggestion-card">
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
