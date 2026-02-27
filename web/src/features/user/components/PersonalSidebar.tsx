"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { getThumbnailUrl } from "@/utils/url";
import type { SuccessResponse } from "@/lib/api-response";

type Conversation = {
  id: number;
  last_message: string;
  unread_count: number;
  other_user: {
    username: string;
    nickname: string;
    avatar_url: string;
  };
};

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

export default function PersonalSidebar() {
  const [activeItem, setActiveItem] = useState("friends");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    fetch("/api/messages/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((payload) => {
        const items = readSuccessData<Conversation[]>(payload) || [];
        setConversations(items);
      })
      .catch((err) => console.error("Failed to load conversations", err));
  }, [token]);

  return (
    <div className="flex h-full flex-col border-r border-[#333] bg-[#0a0a0a]">
      <div className="h-14 shrink-0 px-3 flex items-center">
        <button className="w-full truncate rounded-md border border-[#333] bg-[#111] px-3 py-2 text-left text-sm text-[#a1a1a1] transition-colors hover:border-[#444] hover:text-[#ededed]">
          搜索或开始新的对话
        </button>
      </div>

      <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-2">
        <div
          className={`mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-200 ${
            activeItem === "friends"
              ? "bg-[#0070f3] text-white shadow-[0_2px_8px_rgba(0,112,243,0.2)]"
              : "text-[#a1a1a1] hover:bg-[#111] hover:text-[#ededed]"
          }`}
          onClick={() => setActiveItem("friends")}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path fillRule="evenodd" clipRule="evenodd" d="M14 8.006C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.006C6 5.801 7.795 4.006 10 4.006C12.206 4.006 14 5.801 14 8.006ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.71 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
            <path d="M14 8.006C14 10.211 15.794 12.006 18 12.006C20.206 12.006 22 10.211 22 8.006C22 5.801 20.206 4.006 18 4.006C15.794 4.006 14 5.801 14 8.006Z" opacity="0.5" />
          </svg>
          <span className="font-medium">好友</span>
        </div>

        <div className="group mt-2 flex cursor-pointer items-center justify-between px-4 pb-2 pt-4 text-[#a1a1a1] hover:text-[#ededed]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#666]">私信</h3>
          <button className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <div className="space-y-[1px] px-2">
          {conversations.map((conv) => (
            <DMItem
              key={conv.id}
              username={conv.other_user.nickname || conv.other_user.username}
              avatarUrl={conv.other_user.avatar_url}
              activity={conv.last_message}
              unreadCount={conv.unread_count}
            />
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="mt-4 px-4 py-2 text-center text-xs italic text-[#666]">暂无私信</div>
        )}
      </div>
    </div>
  );
}

type DMItemProps = {
  username: string;
  activity?: string;
  avatarUrl?: string;
  unreadCount: number;
};

function DMItem({ username, activity, avatarUrl, unreadCount }: DMItemProps) {
  return (
    <div className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-all duration-200 hover:bg-[#111]">
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#333] bg-[#111] font-medium text-[#a1a1a1]">
          {avatarUrl ? (
            <Image src={getThumbnailUrl(avatarUrl, 64)} alt={username} width={36} height={36} className="h-full w-full object-cover" unoptimized />
          ) : (
            username[0].toUpperCase()
          )}
        </div>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-[#f23f42] px-1 text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-medium ${unreadCount > 0 ? "text-[#ededed]" : "text-[#a1a1a1] group-hover:text-[#ededed]"}`}>
          {username}
        </div>
        {activity && (
          <div className={`truncate text-xs ${unreadCount > 0 ? "font-medium text-[#ededed]" : "text-[#666] group-hover:text-[#dbdee1]"}`}>
            {activity}
          </div>
        )}
      </div>
    </div>
  );
}
