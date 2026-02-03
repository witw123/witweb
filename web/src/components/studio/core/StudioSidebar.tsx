"use client";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const GridIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="22" height="22">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

export function StudioSidebar({ activeTab, setActiveTab }: SidebarProps) {
  const items = [
    { id: "home", label: "工作台", icon: HomeIcon },
    { id: "video", label: "视频生成", icon: VideoIcon },
  ];

  return (
    <aside className="w-20 md:w-60 border-r border-[#111111] bg-[#050505] flex flex-col shrink-0">
      <div
        className="p-8 hidden md:flex flex-col cursor-pointer group"
        onClick={() => setActiveTab("home")}
      >
        <h1 className="text-xl font-extrabold text-white tracking-[0.3em] font-heading flex flex-col group-hover:opacity-80 transition-opacity">
          <span>STUDIO</span>
          <span className="text-[8px] text-[#0070f3] mt-1 tracking-[0.5em] block">GENERATIVE_AI</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-4 mt-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${activeTab === item.id
              ? "bg-[#0070f3]/10 text-white"
              : "text-[#a1a1a1] hover:text-white hover:bg-white/5"
              }`}
          >
            {activeTab === item.id && (
              <div className="absolute left-0 w-1 h-2/3 bg-[#0070f3] rounded-r-full shadow-[0_0_10px_#0070f3]" />
            )}
            <item.icon className={`transition-transform duration-300 group-hover:scale-110 ${activeTab === item.id ? "text-[#0070f3]" : "text-[#a1a1a1]"}`} />
            <span className="hidden md:block font-bold text-[11px] uppercase tracking-widest font-heading">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[#111111] mb-2">
        <button
          onClick={() => setActiveTab("settings")}
          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[#a1a1a1] hover:text-white hover:bg-white/5 transition-all group ${activeTab === "settings" ? "bg-white/5 text-white" : ""
            }`}
        >
          <SettingsIcon className={`group-hover:rotate-45 transition-transform duration-500 ${activeTab === "settings" ? "text-[#0070f3]" : ""}`} />
          <span className="hidden md:block font-bold text-[11px] uppercase tracking-widest font-heading">设置 (Settings)</span>
        </button>
      </div>
    </aside>
  );
}
