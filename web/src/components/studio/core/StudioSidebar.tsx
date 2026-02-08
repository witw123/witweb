"use client";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const AgentIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 3h6m-6 18h6M5 8h14M5 16h14M7 8v8m10-8v8M9 12h6" />
  </svg>
);

export function StudioSidebar({ activeTab, setActiveTab }: SidebarProps) {
  const items = [
    { id: "home", label: "工作台", icon: HomeIcon },
    { id: "video", label: "视频生成", icon: VideoIcon },
    { id: "agent", label: "AI Agent", icon: AgentIcon },
  ];

  return (
    <aside className="studio-sidebar w-20 shrink-0 flex-col md:w-56">
      <div className="group hidden cursor-pointer flex-col p-6 md:flex" onClick={() => setActiveTab("home")}>
        <div className="studio-sidebar-brand">
          <h1 className="text-lg font-extrabold tracking-[0.2em] text-white transition-opacity group-hover:opacity-80">
            STUDIO
          </h1>
          <span className="mt-1 block text-[9px] font-medium tracking-[0.3em] text-[#0070f3]">创作中心</span>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-2 px-3">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`studio-nav-item w-full ${isActive ? "active" : ""}`}
            >
              <item.icon className={`studio-nav-icon transition-all duration-300 ${isActive ? "scale-110 text-[#0070f3]" : ""}`} />
              <span className="hidden md:block">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

