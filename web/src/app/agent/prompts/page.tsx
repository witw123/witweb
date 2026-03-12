import type { Metadata } from "next";
import { PromptTestPanel } from "@/components/studio/modules/agent/PromptTestPanel";

export const metadata: Metadata = {
  title: "Prompt \u6d4b\u8bd5 - AI Agent",
};

export default function PromptsRoute() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mx-auto max-w-[1000px]">
        <PromptTestPanel />
      </div>
    </div>
  );
}
