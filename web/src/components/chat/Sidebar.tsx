"use client";

import { useChat } from "@/context/ChatContext";
import { Channel } from "@/types/chat";
import { useState } from "react";

export default function Sidebar() {
  const { categories, activeChannelId, setActiveChannel, isAdmin, createChannel } = useChat();
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [creatingInCategory, setCreatingInCategory] = useState<string | null>(null);

  return (
    <div className="w-[260px] flex-shrink-0 bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col relative z-20">
      {/* Sidebar Header */}
      <div className="h-14 flex items-center px-4 border-b border-white/5 shrink-0">
        <h1 className="font-bold text-white tracking-tight">频道</h1>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
        {categories.map(cat => (
          <div key={cat.id}>
            <div className="px-2 mb-2 flex items-center justify-between group">
              <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
                {cat.name}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setCreatingInCategory(cat.id)}
                  className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="创建频道">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              )}
            </div>
            <div className="space-y-[1px]">
              {cat.channels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  isAdmin={isAdmin}
                  onClick={() => setActiveChannel(channel.id)}
                  onEdit={() => setEditingChannel(channel)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* User Panel */}
      <UserPanel />

      {/* Modals */}
      {(creatingInCategory || editingChannel) && (
        <ChannelModal
          mode={creatingInCategory ? "create" : "edit"}
          categoryId={creatingInCategory}
          channel={editingChannel}
          onClose={() => { setCreatingInCategory(null); setEditingChannel(null); }}
        />
      )}
    </div>
  );
}

function ChannelItem({ channel, isActive, isAdmin, onClick, onEdit }: { channel: Channel, isActive: boolean, isAdmin: boolean, onClick: () => void, onEdit: () => void }) {
  return (
    <div className="group relative px-2 py-0.5">
      <button
        onClick={onClick}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group/btn
          ${isActive
            ? "bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 text-white font-medium shadow-[0_0_20px_rgba(99,102,241,0.1)]"
            : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300 font-normal"
          }
        `}
      >
        {channel.type === "voice" ? (
          <svg className={`shrink-0 transition-colors ${isActive ? "text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]" : "text-zinc-600 group-hover/btn:text-zinc-500"}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        ) : (
          <span className={`text-lg leading-none transition-colors ${isActive ? "text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]" : "text-zinc-600 group-hover/btn:text-zinc-500"}`}>#</span>
        )}
        <div className="flex-1 text-left truncate relative">
          {channel.name}
          {isActive && (
            <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] opacity-0 animate-fade-in-left"></span>
          )}
        </div>
        {/* The active strip is confusing inside, let's keep it simple. Clean background is better. */}
        {channel.readOnly && <span className={`ml-1 text-[10px] border px-1.5 py-0.5 rounded uppercase tracking-wider ${isActive ? "border-indigo-500/30 text-indigo-300" : "border-zinc-800 text-zinc-600"}`}>只读</span>}
      </button>

      {isAdmin && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-white/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
      )}
    </div>
  );
}

function ChannelModal({ mode, categoryId, channel, onClose }: {
  mode: "create" | "edit",
  categoryId?: string | null,
  channel?: Channel | null,
  onClose: () => void
}) {
  const { createChannel, updateChannel, deleteChannel } = useChat();
  const [name, setName] = useState(channel?.name || "");
  const [description, setDescription] = useState(channel?.description || "");
  const [readOnly, setReadOnly] = useState(channel?.readOnly || false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      if (mode === "create" && categoryId) {
        // Simple inference: if category is "cat_voice", create voice channel
        const type = categoryId === "cat_voice" ? "voice" : "text";
        await createChannel(categoryId, name, description, readOnly, type);
      } else if (mode === "edit" && channel) {
        await updateChannel(channel.id, { name, description, readOnly });
      }
      onClose();
    } catch (error) {
      console.error(error);
      alert("Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!channel || !confirm("确定要删除这个频道吗？")) return;
    setIsLoading(true);
    try {
      await deleteChannel(channel.id);
      onClose();
    } catch (e) {
      alert("Failed to delete");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1e1f22] border border-white/10 rounded-xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">
          {mode === "create" ? "创建频道" : "编辑频道"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">频道名称</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="例如: 一般讨论"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">频道简介</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-indigo-500 transition-colors h-24 resize-none"
              placeholder="描述这个频道的主题..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="readOnly"
              checked={readOnly}
              onChange={e => setReadOnly(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-black/30 text-indigo-500 focus:ring-indigo-500"
            />
            <label htmlFor="readOnly" className="text-sm text-zinc-400 select-none cursor-pointer">
              设为只读频道 (仅管理员发言)
            </label>
          </div>

          <div className="flex justify-between items-center pt-2">
            {mode === "edit" && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-red-400 text-xs hover:underline"
              >
                删除频道
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserPanel() {
  const { userProfile } = useChat();

  // Default fallback if loading or guest
  const user = userProfile || { username: "游客", nickname: "游客", avatar_url: null };
  const displayName = user.nickname || user.username;
  const username = user.username;

  return (
    <div className="p-3 bg-black/20 border-t border-white/5 shrink-0">
      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white relative overflow-hidden">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            (displayName[0] || "?").toUpperCase()
          )}
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#1e1f22] rounded-full"></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
            {displayName}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            @{username}
          </div>
        </div>
      </div>
    </div>
  );
}
