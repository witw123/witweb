"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/context/ChatContext";
import { Message } from "@/types/chat";
import { getThumbnailUrl } from "@/utils/url";

export default function MessageList() {
  const { messages, activeChannelId, retryMessage, deleteMessage, editMessage, userProfile, isAdmin } = useChat();
  const list = messages[activeChannelId] || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use scrollTop to prevent whole-page scrolling
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [list.length, activeChannelId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 pb-32 custom-scrollbar flex flex-col gap-1"
    >
      {list.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-2 opacity-50 pb-20">
          <span className="text-4xl text-zinc-700">#</span>
          <p>欢迎来到频道起点</p>
        </div>
      )}

      {list.map((msg, index) => {
        const prevMsg = list[index - 1];
        const isGrouped = prevMsg &&
          prevMsg.authorId === msg.authorId &&
          prevMsg.type === "user" &&
          msg.type === "user" &&
          (msg.createdAt - prevMsg.createdAt) < 5 * 60 * 1000;

        // Determine permissions
        const currentUserId = userProfile?.username || userProfile?.id;
        const isAuthor = currentUserId === msg.authorId;
        const canDelete = isAdmin || isAuthor;
        const canEdit = isAuthor;

        return (
          <MessageItem
            key={msg.id}
            message={msg}
            isGrouped={!!isGrouped}
            onRetry={() => retryMessage(msg.id)}
            onDelete={canDelete ? () => deleteMessage(msg.id) : undefined}
            onEdit={canEdit ? (newContent) => editMessage(msg.id, newContent) : undefined}
            canEdit={canEdit}
            canDelete={canDelete}
            isAdmin={isAdmin}
          />
        );
      })}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}

function MessageItem({
  message,
  isGrouped,
  onRetry,
  onDelete,
  onEdit,
  canEdit,
  canDelete,
  isAdmin
}: {
  message: Message,
  isGrouped: boolean,
  onRetry: () => void,
  onDelete?: () => void,
  onEdit?: (val: string) => void,
  canEdit: boolean,
  canDelete: boolean,
  isAdmin: boolean
}) {
  const isSystem = message.type === "system";
  const date = new Date(message.createdAt);
  const timeStr = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";

  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(message.content);

  const handleSaveEdit = () => {
    if (editVal.trim() !== message.content) {
      onEdit?.(editVal);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditVal(message.content);
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="flex items-center gap-2">
          <span className="h-[1px] w-8 bg-zinc-700"></span>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{message.content}</span>
          <span className="h-[1px] w-8 bg-zinc-700"></span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        group flex py-0.5 px-2 -mx-2 rounded hover:bg-white/[0.04] transition-colors relative
        ${isGrouped ? "mt-[2px]" : "mt-4"}
        ${isSending ? "opacity-70" : "opacity-100"}
      `}
    >
      {/* Actions Overlay (Desktop) */}
      {!isEditing && !isSending && !isFailed && (
        <div className="absolute top-0 right-2 -translate-y-1/2 bg-[#1e1f22] border border-white/10 rounded shadow-sm flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 overflow-hidden">
          {canEdit && (
            <button onClick={() => setIsEditing(true)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10" title="Edit">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10" title="Delete">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
            </button>
          )}
        </div>
      )}

      <div className={`flex gap-4 w-full ${isFailed ? "animate-pulse" : ""}`}>

        {/* Avatar */}
        <div className="w-[40px] shrink-0 flex flex-col items-center">
          {!isGrouped ? (
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-sm font-bold border border-white/5 overflow-hidden">
              {message.authorAvatar ? (
                <img src={getThumbnailUrl(message.authorAvatar, 64)} alt="" className="w-full h-full object-cover" />
              ) : (
                (message.authorName[0] || "?").toUpperCase()
              )}
            </div>
          ) : (
            <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 mt-1.5 font-mono">
              {timeStr}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {!isGrouped && (
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-white hover:underline cursor-pointer font-medium text-[15px]">
                {message.authorName}
              </span>
              {isAdmin && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 rounded border border-indigo-500/30">ADMIN</span>}
              <span className="text-[11px] text-zinc-500 font-medium">
                {date.toLocaleDateString()} {timeStr}
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="bg-zinc-800/50 p-2 rounded w-full">
              <textarea
                className="w-full bg-transparent text-zinc-200 outline-none resize-none text-[15px] p-0"
                rows={2}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="text-[10px] text-zinc-500 mt-2 flex gap-2">
                <span className="bg-zinc-700 px-1 rounded text-zinc-300">Enter</span> to save
                <span className="bg-zinc-700 px-1 rounded text-zinc-300">Esc</span> to cancel
              </div>
            </div>
          ) : (
            <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-[15px]">
              {message.content}
              {/* Only show (edited) if we tracked it, skipping for now based on types */}
              {isFailed && (
                <span className="ml-2 text-xs text-red-400 font-bold inline-flex items-center gap-1">
                  (Failed)
                  <button onClick={onRetry} className="underline hover:text-red-300 cursor-pointer">Retry</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
