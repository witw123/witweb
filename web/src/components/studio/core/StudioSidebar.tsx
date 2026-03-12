"use client";

/**
 * StudioSidebar 创作工作台侧边栏组件
 *
 * 提供工作台的侧边导航，包含：
 * - 工作台首页
 * - 视频生成
 * - 选题雷达
 *
 * @component
 * @example
 * <StudioSidebar activeTab="video" setActiveTab={setTab} />
 */

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

/**
 * HomeIcon 首页图标
 */
const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

/**
 * VideoIcon 视频图标
 */
const VideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);



/**
 * RadarIcon 雷达图标
 */
const RadarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.657-5.657l-2.828 2.828M9.17 14.83l-2.827 2.827m0-11.314L9.17 9.17m5.657 5.657l2.828 2.828" />
    <circle cx="12" cy="12" r="3.5" strokeWidth="1.5" />
  </svg>
);

/**
 * StudioSidebar 侧边栏组件
 */
export function StudioSidebar({ activeTab, setActiveTab }: SidebarProps) {
  const items = [
    { id: "home", label: "工作台", icon: HomeIcon },
    { id: "video", label: "视频生成", icon: VideoIcon },

    { id: "radar", label: "选题雷达", icon: RadarIcon },
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

