import type { Metadata } from "next";
import { KnowledgeBase } from "@/features/agent/components/knowledge/KnowledgeBase";

export const metadata: Metadata = {
  title: "\u77e5\u8bc6\u5e93\u7ba1\u7406 - AI Agent",
};

export default function KnowledgeRoute() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mx-auto max-w-[1200px]">
        <KnowledgeBase />
      </div>
    </div>
  );
}
