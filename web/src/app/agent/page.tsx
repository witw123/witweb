import { Suspense } from "react";
import type { Metadata } from "next";
import { ChatThreadWrapper } from "@/features/agent/components/ChatThreadWrapper";

export const metadata: Metadata = {
  title: "AI Agent Chat",
  description: "\u8fdb\u5165 AI \u4ee3\u7406\u5bf9\u8bdd\uff0c\u89c4\u5212\u5e76\u6267\u884c\u5185\u5bb9\u5de5\u4f5c\u6d41\u3002",
  alternates: {
    canonical: "/agent",
  },
};

export const dynamic = "force-dynamic";

export default function AgentRoute() {
  return (
    <Suspense fallback={<div className="flex min-h-[320px] items-center justify-center text-zinc-500">{"\u52a0\u8f7d AI Agent \u4e2d..."}</div>}>
      <ChatThreadWrapper />
    </Suspense>
  );
}
