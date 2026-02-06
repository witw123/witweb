"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";

type Friend = {
  id: number;
  username: string;
  avatar_url?: string;
  status: "online" | "idle" | "dnd" | "offline";
  activity?: string;
  type: "incoming" | "outgoing" | "friend" | "blocked";
  discriminator?: string;
};

export default function FriendsView() {
  const [activeTab, setActiveTab] = useState<"online" | "all" | "pending" | "blocked" | "add">("all");
  const [friends, setFriends] = useState<Friend[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!token) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [followingRes, followersRes] = await Promise.all([
          fetch("/api/following?size=100", { headers }),
          fetch("/api/followers?size=100", { headers }),
        ]);

        if (!followingRes.ok || !followersRes.ok) return;

        const followingResponse = await followingRes.json();
        const followersResponse = await followersRes.json();
        const followingData = followingResponse.data || {};
        const followersData = followersResponse.data || {};

        const map = new Map<string, Friend>();
        let idx = 1;

        (followingData.items || []).forEach((u: any) => {
          map.set(u.username, {
            id: idx++,
            username: u.username,
            avatar_url: u.avatar_url,
            status: u.username === "witw" ? "online" : "offline",
            activity: u.bio,
            type: u.is_mutual ? "friend" : "outgoing",
            discriminator: "0000",
          });
        });

        (followersData.items || []).forEach((u: any) => {
          if (map.has(u.username)) {
            const existing = map.get(u.username)!;
            if (u.is_following) existing.type = "friend";
            return;
          }
          map.set(u.username, {
            id: idx++,
            username: u.username,
            avatar_url: u.avatar_url,
            status: u.username === "witw" ? "online" : "offline",
            activity: u.bio,
            type: "incoming",
            discriminator: "0000",
          });
        });

        setFriends(Array.from(map.values()));
      } catch (error) {
        console.error("Failed to fetch friends", error);
      }
    }

    void fetchData();
  }, [token]);

  const filteredFriends = useMemo(
    () =>
      friends.filter((f) => {
        if (activeTab === "online") return f.status !== "offline" && f.type === "friend";
        if (activeTab === "all") return f.type === "friend";
        if (activeTab === "pending") return f.type === "incoming" || f.type === "outgoing";
        if (activeTab === "blocked") return f.type === "blocked";
        return false;
      }),
    [friends, activeTab]
  );

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <header className="flex h-14 shrink-0 items-center border-b border-[#333] bg-[#050505] px-6 shadow-sm">
        <div className="mr-6 flex items-center gap-2 border-r border-[#333] py-1 pr-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#a1a1a1]">
            <path fillRule="evenodd" clipRule="evenodd" d="M14 8.006C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.006C6 5.801 7.795 4.006 10 4.006C12.206 4.006 14 5.801 14 8.006ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.71 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
          </svg>
          <span className="text-lg font-bold text-[#ededed]">好友</span>
        </div>

        <div className="flex items-center gap-4">
          <TabButton label="在线" isActive={activeTab === "online"} onClick={() => setActiveTab("online")} />
          <TabButton label="全部" isActive={activeTab === "all"} onClick={() => setActiveTab("all")} />
          <TabButton label="待处理" isActive={activeTab === "pending"} onClick={() => setActiveTab("pending")} />
          <TabButton label="已屏蔽" isActive={activeTab === "blocked"} onClick={() => setActiveTab("blocked")} />
          <button
            className={`ml-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              activeTab === "add"
                ? "border-[#0070f3]/30 bg-transparent text-[#0070f3]"
                : "border-transparent bg-[#0070f3] text-white hover:bg-[#0060df]"
            }`}
            onClick={() => setActiveTab("add")}
          >
            添加好友
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-y-auto p-0">
        <div className="flex-1">
          {activeTab === "add" ? (
            <div className="p-8"><AddFriend /></div>
          ) : (
            <>
              <div className="mb-2 mt-6 px-8 text-xs font-bold uppercase tracking-wider text-[#666]">
                {activeTab === "online" && `在线 - ${filteredFriends.length}`}
                {activeTab === "all" && `全部 - ${filteredFriends.length}`}
                {activeTab === "pending" && `待处理 - ${filteredFriends.length}`}
                {activeTab === "blocked" && `已屏蔽 - ${filteredFriends.length}`}
              </div>
              <div className="px-4 pb-4">
                <div className="space-y-2">
                  {filteredFriends.map((friend) => (
                    <FriendItem key={friend.id} friend={friend} />
                  ))}
                </div>
                {filteredFriends.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-70">
                    <Image src="/empty-friends.svg" alt="empty friends" width={160} height={160} className="mb-4 h-40 w-40 grayscale" />
                    <p className="text-[#666]">这里空空如也...</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="hidden w-[360px] pl-6 xl:block">
          <h3 className="mb-4 text-xl font-bold text-[#ededed]">好友动态</h3>
          <div className="rounded-lg border border-[#333] bg-[#111] p-8 text-center">
            <h4 className="mb-2 font-bold text-[#ededed]">现在很安静....</h4>
            <p className="text-sm text-[#a1a1a1]">当好友开始活动时（例如游戏中或语音聊天中），状态会显示在这里。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
        isActive ? "bg-[#111] text-white shadow-[0_0_0_1px_#333]" : "text-[#a1a1a1] hover:bg-[#111] hover:text-[#ededed]"
      }`}
    >
      {label}
    </button>
  );
}

function FriendItem({ friend }: { friend: Friend }) {
  return (
    <div className="group flex cursor-pointer items-center justify-between rounded-lg border-t border-[#333]/50 p-3 transition-colors hover:bg-[#111]">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${friend.avatar_url ? "" : "bg-[#0070f3]"} font-medium text-white`}>
            {friend.avatar_url ? (
              <Image src={friend.avatar_url} alt={friend.username} width={40} height={40} className="h-full w-full rounded-full object-cover" unoptimized />
            ) : (
              friend.username[0].toUpperCase()
            )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#050505] ${
            friend.status === "online" ? "bg-green-500" : friend.status === "idle" ? "bg-yellow-500" : friend.status === "dnd" ? "bg-red-500" : "bg-gray-500"
          }`}></div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-white">{friend.username}</span>
            <span className="hidden text-xs text-[#dbdee1] opacity-60 group-hover:inline">#{friend.discriminator || "0000"}</span>
          </div>
          <div className="text-xs text-[#949ba4]">{friend.status === "offline" ? "离线" : friend.activity || friend.status}</div>
        </div>
      </div>

      <div className="relative flex items-center gap-2 rounded bg-[#313338] p-1 opacity-0 group-hover:opacity-100">
        <ActionButton icon={<MessageIcon />} />
        <ActionButton icon={<MoreIcon />} />
      </div>
    </div>
  );
}

function AddFriend() {
  return (
    <div className="mt-2">
      <h3 className="mb-2 text-sm font-bold uppercase text-white">添加好友</h3>
      <p className="mb-4 text-xs text-[#949ba4]">你可以使用用户名来添加好友。（示例: witw）</p>

      <div className="flex items-center rounded border border-[#1e1f22] bg-[#1e1f22] p-2 transition-colors focus-within:border-[#5865f2]">
        <input
          type="text"
          placeholder="输入用户名并发送请求"
          className="w-full border-none bg-transparent px-2 text-white focus:outline-none"
        />
        <button className="cursor-not-allowed rounded bg-[#5865f2] px-4 py-1.5 text-sm font-medium text-white opacity-50">
          发送好友请求
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center opacity-70">
        <Image src="/wumpus-friends.svg" alt="friends empty" width={256} height={160} className="h-40 w-64 grayscale" />
        <p className="mt-4 text-[#949ba4]">Wumpus 正在等着新的朋友...</p>
      </div>
    </div>
  );
}

function ActionButton({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#2b2d31] text-[#dbdee1] hover:text-white">
      {icon}
    </div>
  );
}

const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
);

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);
