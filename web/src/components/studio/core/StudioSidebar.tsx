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

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export function StudioSidebar({ activeTab, setActiveTab }: SidebarProps) {
  const items = [
    { id: "home", label: "工作台", icon: HomeIcon },
    { id: "video", label: "视频生成", icon: VideoIcon },
  ];

  return (
    <aside className="studio-sidebar w-20 md:w-56 flex flex-col shrink-0">
      {/* Brand */}
      <div
        className="p-6 hidden md:flex flex-col cursor-pointer group"
        onClick={() => setActiveTab("home")}
      >
        <div className="studio-sidebar-brand">
          <h1 className="text-lg font-extrabold text-white tracking-[0.2em] group-hover:opacity-80 transition-opacity">
            STUDIO
          </h1>
          <span className="text-[9px] text-[#0070f3] mt-1 tracking-[0.3em] block font-medium">
            GENERATIVE AI
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2 mt-4">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`studio-nav-item w-full ${isActive ? 'active' : ''}`}
            >
              <item.icon className={`studio-nav-icon transition-all duration-300 ${isActive ? 'text-[#0070f3] scale-110' : ''}`} />
              <span className="hidden md:block">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

