"use client";

import { useChat } from "@/context/ChatContext";

export default function ChatHeader() {
  const { activeChannelId, channels } = useChat();
  const channel = channels.find(c => c.id === activeChannelId);

  if (!channel) return null;

  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-md relative z-10">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-2xl font-light">#</span>
        <div className="flex flex-col">
          <h2 className="font-bold text-white leading-none">{channel.name}</h2>
          <span className="text-[10px] text-zinc-500 font-medium mt-1">
            {channel.description || (channel.readOnly ? "只读频道" : "加密全球频道")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Mock Search Bar */}
        <div className="relative group hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <svg width="14" height="14" fill="none" stroke="currentColor" className="text-zinc-500" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
          <input
            type="text"
            placeholder="搜索..."
            className="bg-black/30 border border-white/5 rounded text-xs py-1.5 pl-8 pr-2 w-32 focus:w-48 transition-all text-white focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <button className="text-zinc-400 hover:text-white p-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
        </button>
      </div>
    </header>
  );
}
