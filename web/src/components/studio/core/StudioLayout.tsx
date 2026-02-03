"use client";

import { useState } from "react";
import { StudioSidebar } from "./StudioSidebar";
import { StudioDashboard } from "./StudioDashboard";

// Module: Video
import { VideoLayout } from "../modules/video/VideoLayout";

// Module: Settings
import { SettingsPanel as StudioSettings } from "../modules/settings/SettingsPanel";

export default function StudioLayout() {
  const [activeTab, setActiveTab] = useState("home");

  // Helper to determine if we are in video module context
  const isVideoModule = activeTab === "video" || activeTab.startsWith("video-");

  // Extract sub-tab for VideoLayout if present (e.g., "video-character" -> "character")
  const videoSubTab = activeTab.startsWith("video-") ? activeTab.replace("video-", "") : "create";

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[600px] bg-[#050505] rounded-3xl border border-[#333333] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] text-[#ededed] font-sans">
      <StudioSidebar activeTab={isVideoModule ? "video" : activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]/40 backdrop-blur-3xl">
        <header className="h-16 border-b border-[#111111] flex items-center px-8 justify-between shrink-0 bg-[#050505]/20">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'home' ? 'bg-[#adeded]' : 'bg-[#0070f3]'}`} />
            <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] font-heading">
              {activeTab === "home" && "创作工作台"}
              {isVideoModule && "视频生成中心"}
              {activeTab === "settings" && "配置管理"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* <span className="text-[10px] text-[#a1a1a1] font-mono tracking-widest uppercase bg-[#111111] px-3 py-1 rounded-full border border-[#333333]">SORA-2_ENGINE_ACTIVE</span> */}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="h-full animate-in fade-in duration-700">
            {activeTab === "home" && <StudioDashboard setActiveTab={setActiveTab} />}
            {isVideoModule && <VideoLayout initialTab={videoSubTab} />}
            {activeTab === "settings" && <StudioSettings />}
          </div>
        </div>
      </main>
    </div>
  );
}
