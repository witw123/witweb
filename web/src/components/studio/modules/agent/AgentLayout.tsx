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
    <section className="agent-shell">
      <div className="agent-head">
        <div>
          <h2 className="agent-title">AI 创作代理</h2>
          <p className="agent-subtitle">围绕选题、写作和发布流程组织你的内容创作。</p>
        </div>
      </div>

      <div className="agent-tabbar studio-toolbar mb-3 rounded-2xl p-1.5">
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

      <div className="agent-content-shell studio-panel studio-panel-glass min-h-[620px]">
        {activeTab === "create" && <AgentCreate onTaskCreated={() => setActiveTab("tasks")} />}
        {activeTab === "assistants" && <AgentAssistants />}
        {activeTab === "tasks" && <AgentTaskList />}
        {activeTab === "gallery" && <AgentGallery />}
      </div>
    </section>
  );
}
