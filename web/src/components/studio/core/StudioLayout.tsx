"use client";

/**
 * StudioLayout 创作工作台布局组件
 *
 * 工作台的主布局容器，包含：
 * - 侧边栏导航（StudioSidebar）
 * - 顶部标题栏
 * - 主内容区域（根据 activeTab 切换不同模块）
 *   - 仪表盘（StudioDashboard）
 *   - 视频生成模块（VideoLayout）
 *   - 选题雷达模块（RadarLayout）
 *
 * @component
 * @example
 * <StudioLayout />
 */

import { useState } from "react";
import { StudioSidebar } from "./StudioSidebar";
import { StudioDashboard } from "./StudioDashboard";
import { VideoLayout } from "../modules/video/VideoLayout";

import { RadarLayout } from "../modules/radar/RadarLayout";

/**
 * StudioLayout 组件 - 工作台主布局
 */
export default function StudioLayout() {
  const [activeTab, setActiveTab] = useState("home");

  const isVideoModule = activeTab === "video" || activeTab.startsWith("video-");
  const videoSubTab = activeTab.startsWith("video-") ? activeTab.replace("video-", "") : "create";

  const getHeaderTitle = () => {
    if (activeTab === "home") return "创作工作台";
    if (isVideoModule) return "视频生成中心";

    if (activeTab === "radar") return "选题雷达";
    return "Studio";
  };

  return (
    <div className="studio-container relative flex h-[calc(100vh-160px)] min-h-[600px] overflow-hidden font-sans text-[#ededed]">
      <div className="studio-bg-glow studio-bg-glow-blue absolute -right-40 -top-40 h-[600px] w-[600px]" />
      <div className="studio-bg-glow studio-bg-glow-purple absolute -bottom-40 -left-40 h-[500px] w-[500px]" />

      <StudioSidebar activeTab={isVideoModule ? "video" : activeTab} setActiveTab={setActiveTab} />

      <main className="studio-main flex flex-1 flex-col overflow-hidden">
        <header className="studio-header flex shrink-0 items-center justify-center px-8">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">{getHeaderTitle()}</h2>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
          <div className="h-full animate-in fade-in duration-500">
            {activeTab === "home" && <StudioDashboard setActiveTab={setActiveTab} />}
            {isVideoModule && <VideoLayout initialTab={videoSubTab} />}

            {activeTab === "radar" && <RadarLayout />}
          </div>
        </div>
      </main>
    </div>
  );
}
