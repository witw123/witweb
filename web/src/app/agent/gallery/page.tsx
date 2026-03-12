import type { Metadata } from "next";
import { AgentGallery } from "@/components/studio/modules/agent/AgentGallery";

export const metadata: Metadata = {
  title: "\u4f5c\u54c1\u753b\u5eca - AI Agent",
};

export default function GalleryRoute() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mx-auto max-w-[1200px]">
        <AgentGallery />
      </div>
    </div>
  );
}
