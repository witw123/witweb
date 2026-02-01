"use client";

import { useEffect, useState } from "react";
import * as channelService from "@/services/channelService";

interface Channel {
  id: number;
  name: string;
  type: "text" | "voice";
  message_count?: number;
}

interface Category {
  id: number;
  name: string;
  channels: Channel[];
}

export default function ChannelList({
  activeChannelId,
  onSelectChannel
}: {
  activeChannelId: number | null;
  onSelectChannel: (id: number, name: string) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const data = await channelService.getChannels();
        if (Array.isArray(data)) {
          setCategories(data);
        }
      } catch (err) {
        console.error("Failed to load channels", err);
      } finally {
        setLoading(false);
      }
    }
    fetchChannels();
  }, []);

  if (loading) {
    return (
      <div className="w-[280px] flex-shrink-0 bg-black/40 backdrop-blur-xl h-full border-r border-white/5 p-6 flex flex-col gap-4">
        <div className="h-6 w-24 bg-white/5 rounded animate-pulse" />
        <div className="h-10 w-full bg-white/5 rounded-lg animate-pulse" />
        <div className="h-10 w-full bg-white/5 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-[280px] flex-shrink-0 bg-black/40 backdrop-blur-xl h-full border-r border-white/5 flex flex-col relative overflow-hidden group/sidebar">
      {/* Decorative Gradient Blob */}
      <div className="absolute top-0 left-0 w-full h-32 bg-indigo-500/10 blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-white/5 relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
          <h2 className="font-bold text-white tracking-tight text-lg">WIT STUDIO</h2>
        </div>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar relative z-10">
        {categories.map((category) => (
          (category.channels && category.channels.length > 0) && (
            <div key={category.id || "uncategorized"} className="animate-in fade-in slide-in-from-left-4 duration-500">
              {/* Category Title */}
              <div className="px-3 mb-3 flex items-center justify-between group/cat">
                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.15em] group-hover/cat:text-zinc-300 transition-colors">
                  {category.name}
                </span>
                <span className="h-[1px] flex-1 bg-white/5 ml-3 opacity-0 group-hover/cat:opacity-100 transition-opacity"></span>
              </div>

              {/* Channels */}
              <div className="space-y-1">
                {category.channels.map((channel) => {
                  const isActive = activeChannelId === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => onSelectChannel(channel.id, channel.name)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden group/item
                        ${isActive
                          ? "bg-white/10 text-white shadow-lg"
                          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        }
                      `}
                    >
                      {/* Active Glow Background */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-transparent opacity-50 blur-sm" />
                      )}

                      {/* Active Border Indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      )}

                      {/* Icon */}
                      <span className={`relative text-lg leading-none transition-colors duration-300 ${isActive ? "text-indigo-400 scale-110" : "text-zinc-600 group-hover/item:text-zinc-400"}`}>
                        #
                      </span>

                      {/* Name */}
                      <span className="relative truncate">
                        {channel.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}
      </div>

      {/* User / Footer Area */}
      <div className="p-4 bg-black/20 border-t border-white/5 relative z-10">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group/user">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
            W
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate group-hover/user:text-indigo-300 transition-colors">User</div>
            <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Online
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
