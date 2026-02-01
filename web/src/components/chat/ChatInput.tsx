"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChat } from "@/context/ChatContext";

export default function ChatInput() {
  const { activeChannelId, channels, drafts, setDraft, sendMessage, isAdmin } = useChat();
  const channel = channels.find(c => c.id === activeChannelId);

  // Local state for immediate input control
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync with drafts from context
  useEffect(() => {
    setText(drafts[activeChannelId] || "");
    // Focus when channel changes (if writable or admin)
    if (channel && (!channel.readOnly || isAdmin)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [activeChannelId, drafts, channel, isAdmin]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setText(newVal);
    setDraft(newVal); // Updating draft in context automatically saves it
  };

  const handleSend = async () => {
    if (!text.trim() || !channel) return;
    if (channel.readOnly && !isAdmin) return;

    const content = text.trim();
    setText(""); // Clear immediately for UX

    await sendMessage(content);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Adjust height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [text]);

  const isReadOnly = channel?.readOnly && !isAdmin;

  return (
    <div className="p-4 pt-1 absolute bottom-0 left-0 w-full z-20">
      <div className={`
         bg-black/60 backdrop-blur-xl border transition-colors rounded-[18px] flex flex-col gap-2 p-2 shadow-2xl
         ${isReadOnly ? "border-transparent opacity-80" : "border-white/10 hover:border-white/20 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20"}
       `}>
        {isReadOnly ? (
          <div className="h-12 flex items-center justify-center text-zinc-500 text-sm font-medium gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            只读频道
          </div>
        ) : (
          <>
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={`发送消息给 #${channel?.name}...`}
              rows={1}
              className="w-full bg-transparent text-white border-none outline-none resize-none px-3 py-2 max-h-[200px] text-[15px]"
            />

            {/* Visual Toolbar */}
            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex gap-2">
                <button className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 rounded-full transition">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                </button>
              </div>

              <span className="text-[10px] text-zinc-600 font-mono hidden md:block">
                回车发送，Shift+回车换行
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
