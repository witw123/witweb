"use client";

import { useState } from "react";
import { CreateForm } from "./CreateForm";
import { CharacterLab } from "./CharacterLab";
import { TaskList } from "./TaskList";
import { Gallery } from "./Gallery";
import { SettingsPanel } from "../settings/SettingsPanel";

interface VideoLayoutProps {
  initialTab?: string;
}

const tabs = [
  { id: "create", label: "视频生成" },
  { id: "character", label: "角色管理" },
  { id: "active", label: "任务列表" },
  { id: "history", label: "作品库" },
  { id: "settings", label: "设置" },
] as const;

export function VideoLayout({ initialTab = "create" }: VideoLayoutProps) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  return (
    <section className="h-full">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">视频生成中心</h2>
          <p className="mt-1 text-sm text-[#95a1b8]">生成、角色、任务、作品与设置，统一在这里管理。</p>
        </div>

        <div className="studio-toolbar mb-6 justify-center rounded-2xl p-2">
          {tabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`studio-tab ${isActive ? "active" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="studio-panel studio-panel-glass">
          {activeSubTab === "create" && <CreateForm onTaskCreated={() => setActiveSubTab("active")} />}
          {activeSubTab === "character" && <CharacterLab />}
          {activeSubTab === "active" && <TaskList />}
          {activeSubTab === "history" && <Gallery />}
          {activeSubTab === "settings" && <SettingsPanel />}
        </div>
      </div>
    </section>
  );
}
