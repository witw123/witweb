import type { Metadata } from "next";
import { AgentAssistants } from "@/components/studio/modules/agent/AgentAssistants";

export const metadata: Metadata = {
  title: "\u52a9\u624b\u914d\u7f6e - AI Agent",
};

export default function AssistantsRoute() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mx-auto max-w-[1000px]">
        <AgentAssistants />
      </div>
    </div>
  );
}
