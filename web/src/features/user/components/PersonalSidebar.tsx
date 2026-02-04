"use client";

import { useState, useEffect } from "react";
import UserHoverCard from "./UserHoverCard";
import { getThumbnailUrl } from "@/utils/url";
import { useAuth } from "@/app/providers";

type Conversation = {
  id: number;
  user1: string;
  user2: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  other_user: {
    username: string;
    nickname: string;
    avatar_url: string;
  };
};

export default function PersonalSidebar() {
  const [activeItem, setActiveItem] = useState("friends");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    fetch("/api/messages/conversations", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setConversations(data);
        } else {
          console.error("API returned non-array:", data);
          setConversations([]);
        }
      })
      .catch(err => console.error("Failed to load conversations", err));
  }, [token]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-[#333]">
      {/* Search Bar / Find conversation */}
      <div className="h-14 flex items-center px-3 shrink-0">
        <button className="w-full bg-[#111] border border-[#333] text-left text-sm text-[#a1a1a1] px-3 py-2 rounded-md transition-colors hover:border-[#444] hover:text-[#ededed] truncate">
          寻找或开始新的对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2">
        {/* Navigation Items */}
        <div
          className={`px-3 py-2.5 mx-2 rounded-md flex items-center gap-3 cursor-pointer transition-all duration-200 
            ${activeItem === "friends"
              ? "bg-[#0070f3] text-white shadow-[0_2px_8px_rgba(0,112,243,0.2)]"
              : "text-[#a1a1a1] hover:bg-[#111] hover:text-[#ededed]"}`}
          onClick={() => setActiveItem("friends")}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path fillRule="evenodd" clipRule="evenodd" d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.71 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
            <path d="M14 8.00598C14 10.211 15.794 12.006 18 12.006C20.206 12.006 22 10.211 22 8.00598C22 5.80098 20.206 4.00598 18 4.00598C15.794 4.00598 14 5.80098 14 8.00598Z" opacity="0.5" />
            <path d="M20 19.006V20.006H18V19.006C18 16.9056 16.8912 15.1437 15.2043 14.1568C15.7289 14.0531 16.3263 14.006 17 14.006C20.767 14.006 22 15.473 22 19.006Z" opacity="0.5" />
          </svg>
          <span className="font-medium">好友</span>
        </div>

        {/* DM List Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 group cursor-pointer text-[#a1a1a1] hover:text-[#ededed] mt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#666]">私信</h3>
          <button className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        {/* DM Items */}
        <div className="space-y-[1px] px-2">
          {conversations.map(conv => (
            <DMItem
              key={conv.id}
              username={conv.other_user.nickname || conv.other_user.username}
              avatarUrl={conv.other_user.avatar_url}
              status="offline"
              activity={conv.last_message}
              unreadCount={conv.unread_count}
            />
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="text-xs text-[#666] px-4 py-2 italic text-center mt-4">
            暂无私信
          </div>
        )}
      </div>

      {/* User Footer */}
    </div>
  );
}

function DMItem({ username, status, activity, avatarUrl, unreadCount }: any) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#111] cursor-pointer group transition-all duration-200">
      <div className="relative shrink-0">
        <div className={`w-9 h-9 rounded-full bg-[#111] flex items-center justify-center text-[#a1a1a1] font-medium overflow-hidden border border-[#333]`}>
          {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : username[0].toUpperCase()}
        </div>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[#f23f42] text-white text-[10px] flex items-center justify-center px-1 border-2 border-[#0a0a0a]">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium truncate group-hover:text-[#ededed] ${unreadCount > 0 ? "text-[#ededed]" : "text-[#a1a1a1]"}`}>{username}</span>
        </div>
        {activity && (
          <div className={`text-xs truncate group-hover:text-[#dbdee1] ${unreadCount > 0 ? "text-[#ededed] font-medium" : "text-[#666]"}`}>
            {activity}
          </div>
        )}
      </div>
    </div>
  )
}
