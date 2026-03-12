"use client";

import { useState } from "react";
import "@/styles/agent-chat.css";
import { ChatSidebar } from "./ChatSidebar";

export function AgentChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="agent-chat-layout">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="agent-sidebar-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar: Global Navigation & Chat History */}
      <ChatSidebar
        onCloseMobile={() => setSidebarOpen(false)}
        isOpen={sidebarOpen}
      />

      {/* Main Content Area */}
      <main className="agent-chat-main">
        {/* Mobile Header (Only visible on small screens to toggle sidebar) */}
        <header className="agent-chat-header md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-zinc-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold ml-4">AI Agent</span>
        </header>

        {children}
      </main>
    </div>
  );
}
