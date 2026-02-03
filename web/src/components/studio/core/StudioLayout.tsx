"use client";

import { useState } from "react";
import { StudioSidebar } from "./StudioSidebar";
import { StudioDashboard } from "./StudioDashboard";

// Module: Video
import { VideoLayout } from "../modules/video/VideoLayout";

export default function StudioLayout() {
  const [activeTab, setActiveTab] = useState("home");

  // Helper to determine if we are in video module context
  const isVideoModule = activeTab === "video" || activeTab.startsWith("video-");

  // Extract sub-tab for VideoLayout if present (e.g., "video-character" -> "character")
  const videoSubTab = activeTab.startsWith("video-") ? activeTab.replace("video-", "") : "create";

  const getHeaderTitle = () => {
    if (activeTab === "home") return "创作工作台";
    if (isVideoModule) return "视频生成中心";
    return "Studio";
  };

  return (
    <div className="studio-container flex h-[calc(100vh-160px)] min-h-[600px] relative text-[#ededed] font-sans overflow-hidden">
      {/* Background decorative elements */}
      <div className="studio-bg-glow studio-bg-glow-blue absolute -top-40 -right-40 w-[600px] h-[600px]" />
      <div className="studio-bg-glow studio-bg-glow-purple absolute -bottom-40 -left-40 w-[500px] h-[500px]" />

      <StudioSidebar activeTab={isVideoModule ? "video" : activeTab} setActiveTab={setActiveTab} />

      <main className="studio-main flex-1 flex flex-col overflow-hidden">
        <header className="studio-header flex items-center px-8 justify-center shrink-0">
          <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em]">
            {getHeaderTitle()}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="h-full animate-in fade-in duration-500">
            {activeTab === "home" && <StudioDashboard setActiveTab={setActiveTab} />}
            {isVideoModule && <VideoLayout initialTab={videoSubTab} />}
          </div>
        </div>
      </main>
    </div>
  );
}
