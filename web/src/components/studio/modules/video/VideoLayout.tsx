"use client";

import { useState, useEffect } from "react";
import { CreateForm } from "./CreateForm";
import { CharacterLab } from "./CharacterLab";
import { TaskList } from "./TaskList";
import { Gallery } from "./Gallery";

interface VideoLayoutProps {
  initialTab?: string;
}

export function VideoLayout({ initialTab = "create" }: VideoLayoutProps) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  // Sync internal state if prop changes (e.g. from Dashboard navigation)
  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  const tabs = [
    { id: "create", label: "开始创作" },
    { id: "character", label: "角色管理" },
    { id: "active", label: "任务列表" },
    { id: "history", label: "作品图库" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Module Header / Navigation */}
      <div className="flex items-center gap-12 mb-10 border-b border-[#333333] px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`py-6 text-sm font-bold tracking-[0.1em] transition-all relative font-heading ${activeSubTab === tab.id
                ? "text-[#0070f3]"
                : "text-[#888888] hover:text-[#ededed]"
              }`}
          >
            {tab.label}
            {activeSubTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#0070f3] shadow-[0_0_15px_#0070f3] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500">
          {activeSubTab === "create" && <CreateForm />}
          {activeSubTab === "character" && <CharacterLab />}
          {activeSubTab === "active" && <TaskList />}
          {activeSubTab === "history" && <Gallery />}
        </div>
      </div>
    </div>
  );
}
