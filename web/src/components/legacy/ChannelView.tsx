"use client";

import { useEffect, useRef, useState } from "react";
import { getThumbnailUrl } from "@/utils/url";
import * as channelService from "@/services/channelService";
import UserHoverCard from "@/components/legacy/UserHoverCard";
import BotBadge from "@/components/ui/BotBadge";

export default function ChannelView({
  channelId,
  channelName
}: {
  channelId: string | number | null,
  channelName?: string
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [profile, setProfile] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "{}");
    } catch {
      return {};
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!token) {
      alert("请先登录");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setSending(true);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setNewMessage(prev => prev + `![image](${data.url})\n`);

      setTimeout(() => {
        const textarea = document.querySelector('.chat-input-field') as HTMLTextAreaElement;
        textarea?.focus();
      }, 100);

    } catch (error) {
      console.error("Upload error:", error);
      alert("图片上传失败");
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const parseMessageContent = (content: string) => {
    const parts = content.split(/(!\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imageMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
        const [_, alt, src] = imageMatch;
        return (
          <img
            key={index}
            src={src}
            alt={alt}
            className="max-w-[400px] max-h-[400px] rounded-2xl mt-3 mb-2 block cursor-pointer hover:shadow-2xl transition-all hover:scale-[1.01]"
            onClick={() => window.open(src, '_blank')}
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      if (custom?.detail) {
        setProfile(custom.detail);
      } else {
        try {
          setProfile(JSON.parse(localStorage.getItem("profile") || "{}"));
        } catch { }
      }
      if (channelId) {
        loadMessages(true);
      }
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;

    loadMessages();
    const interval = setInterval(() => {
      loadMessages(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [channelId]);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await channelService.getMessages(channelId as string | number);
      setMessages(data.reverse());

      if (!silent) {
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !token || !channelId) return;

    try {
      setSending(true);
      const message = await channelService.postMessage(channelId, newMessage.trim());
      setMessages([...messages, message]);
      setNewMessage("");

      setTimeout(scrollToBottom, 100);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string | number) => {
    if (!confirm("确定要删除这条消息吗？")) return;

    try {
      await channelService.deleteMessage(messageId);
      setMessages(messages.filter((m) => m.id !== messageId));
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <div className="text-sm font-medium tracking-wide">LOADING SECURE CHANNEL</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0b] relative">
      /* Background Glow */
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 h-16 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center justify-between px-6 z-20 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              #{channelName || "General"}
            </h1>
            <p className="text-xs text-zinc-400 font-medium mt-1">Global encrypted channel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs font-medium text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live
          </div>
        </div>
      </header>

      {/* Messages Area - Push content down */}
      <div className="flex-1 overflow-y-auto pt-24 pb-4 px-4 custom-scrollbar" ref={messagesContainerRef}>
        <div className="max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/5">
                <span className="text-4xl text-zinc-600">#</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to #{channelName}</h2>
              <p className="text-zinc-500">This is the start of something new.</p>
            </div>
          ) : (
            messages.map((message, idx) => {
              const prevMsg = messages[idx - 1];
              const isSameAuthor = prevMsg && prevMsg.username === message.username;
              const isRecenyMsg = prevMsg && (new Date(message.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 7 * 60 * 1000);
              const isGrouped = isSameAuthor && isRecenyMsg;

              return (
                <div key={message.id} className={`group ${isGrouped ? "mt-1" : "mt-8"} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                  {!isGrouped ? (
                    <div className="flex gap-5">
                      <div className="shrink-0 pt-1">
                        <UserHoverCard username={message.username}>
                          {message.user_avatar ? (
                            <img src={getThumbnailUrl(message.user_avatar, 64)} alt="" className="w-12 h-12 rounded-2xl shadow-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-400 font-bold border border-white/5 shadow-lg">
                              {message.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </UserHoverCard>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <UserHoverCard username={message.username}>
                            <span className="text-base font-bold text-white cursor-pointer hover:text-indigo-400 transition-colors">{message.username}</span>
                          </UserHoverCard>
                          {message.is_bot && <BotBadge />}
                          <span className="text-xs text-zinc-500 font-medium">
                            {new Date(message.created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-zinc-300 leading-relaxed text-[15px]">{parseMessageContent(message.content)}</div>
                      </div>
                      {profile.username === "witw" && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-start">
                          <button onClick={() => handleDelete(message.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-5">
                      <div className="w-12 shrink-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-zinc-600 font-mono mt-1">
                          {new Date(message.created_at).getHours()}:{new Date(message.created_at).getMinutes().toString().padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-zinc-300 leading-relaxed text-[15px]">{parseMessageContent(message.content)}</div>
                      </div>
                      {profile.username === "witw" && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-start">
                          <button onClick={() => handleDelete(message.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Floating Input Area */}
      <div className="p-6 relative z-20">
        <div className="max-w-4xl mx-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-2xl p-2 flex flex-col gap-2 transition-all focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${channelName || "General"}...`}
            className="chat-input-field w-full bg-transparent border-none text-white placeholder-zinc-500 px-4 py-3 min-h-[48px] max-h-[200px] resize-none focus:outline-none text-[15px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-1">
              <button onClick={handleUploadClick} className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors" title="Upload Image">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              </button>
              <button className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors" title="Add Emoji">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
              </button>
            </div>
            <button
              onClick={() => handleSend()}
              disabled={sending || !newMessage.trim()}
              className={`px-4 py-1.5 rounded-full font-bold text-sm shadow-lg transition-all ${sending || !newMessage.trim()
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25 active:scale-95"
                }`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

