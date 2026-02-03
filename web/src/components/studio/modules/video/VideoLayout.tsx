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
  { id: "create", label: "开始创作" },
  { id: "character", label: "角色管理" },
  { id: "active", label: "任务列表" },
  { id: "history", label: "作品图库" },
  { id: "settings", label: "设置" },
] as const;

export function VideoLayout({ initialTab = "create" }: VideoLayoutProps) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  return (
    <section className="h-full">
      <div className="mx-auto w-full max-w-6xl">
        {/* Tab Navigation */}
        <div className="mb-10 flex flex-wrap justify-center gap-3 pb-6">
          {tabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`studio-tab ${isActive ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="studio-panel studio-panel-glass">
          {activeSubTab === "create" && <CreateForm />}
          {activeSubTab === "character" && <CharacterLab />}
          {activeSubTab === "active" && <TaskList />}
          {activeSubTab === "history" && <Gallery />}
          {activeSubTab === "settings" && <SettingsPanel />}
        </div>
      </div>
    </section>
  );
}

