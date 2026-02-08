"use client";

import { useState } from "react";
import { AgentCreate } from "./AgentCreate";
import { AgentTaskList } from "./AgentTaskList";
import { AgentGallery } from "./AgentGallery";
import { AgentAssistants } from "./AgentAssistants";

interface AgentLayoutProps {
  initialTab?: string;
}

const tabs = [
  { id: "create", label: "创作模式" },
  { id: "assistants", label: "自定义助手" },
  { id: "tasks", label: "任务列表" },
  { id: "gallery", label: "作品库" },
] as const;

export function AgentLayout({ initialTab = "create" }: AgentLayoutProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <section className="h-full">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">AI 创作代理</h2>
          <p className="mt-1 text-sm text-[#95a1b8]">智能规划与长文写作助手，支持多种创作模式。</p>
        </div>

        <div className="studio-toolbar mb-6 justify-center rounded-2xl p-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`studio-tab ${isActive ? "active" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="studio-panel studio-panel-glass min-h-[600px]">
          {activeTab === "create" && <AgentCreate onTaskCreated={() => setActiveTab("tasks")} />}
          {activeTab === "assistants" && <AgentAssistants />}
          {activeTab === "tasks" && <AgentTaskList />}
          {activeTab === "gallery" && <AgentGallery />}
        </div>
      </div>
    </section>
  );
}
