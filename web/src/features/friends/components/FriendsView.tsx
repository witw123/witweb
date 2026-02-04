"use client";

import { useState, useEffect } from "react";
import UserHoverCard from "./UserHoverCard";
import { getThumbnailUrl } from "@/utils/url";
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
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!token) return;
      try {
        setLoading(true);
        const headers = { "Authorization": `Bearer ${token}` };
        const [followingRes, followersRes] = await Promise.all([
          fetch("/api/following?size=100", { headers }),
          fetch("/api/followers?size=100", { headers })
        ]);

        if (!followingRes.ok || !followersRes.ok) {
          throw new Error("Failed to fetch friends data");
        }

        const followingData = await followingRes.json();
        const followersData = await followersRes.json();

        const friendsMap = new Map<string, Friend>();

        // Process following (Friends or Outgoing)
        followingData.items.forEach((u: any) => {
          const type = u.is_mutual ? 'friend' : 'outgoing';
          friendsMap.set(u.username, {
            id: Math.random(), // Temporary ID as API doesn't return ID directly mostly
            username: u.username,
            avatar_url: u.avatar_url,
            status: u.username === 'witw' ? 'online' : 'offline', // Mock status
            activity: u.bio,
            type: type,
            discriminator: "0000"
          });
        });

        // Process followers (Friends or Incoming)
        followersData.items.forEach((u: any) => {
          if (friendsMap.has(u.username)) {
            // Already processed as mutual or outgoing, ensure it's marked as friend if mutual
            // (listFollowing already checks mutual, so mostly handled, but let's double check)
            const existing = friendsMap.get(u.username)!;
            if (u.is_following) { // is_following means ME following THEM
              existing.type = 'friend';
            }
          } else {
            // Not following them, so it's incoming
            friendsMap.set(u.username, {
              id: Math.random(),
              username: u.username,
              avatar_url: u.avatar_url,
              status: u.username === 'witw' ? 'online' : 'offline',
              activity: u.bio,
              type: 'incoming',
              discriminator: "0000"
            });
          }
        });

        setFriends(Array.from(friendsMap.values()));
      } catch (error) {
        console.error("Failed to fetch friends", error);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchData();
    }
  }, [token]);

  const filteredFriends = friends.filter(f => {
    if (activeTab === "online") return f.status !== "offline" && f.type === "friend";
    if (activeTab === "all") return f.type === "friend";
    if (activeTab === "pending") return f.type === "incoming" || f.type === "outgoing";
    if (activeTab === "blocked") return f.type === "blocked";
    return false;
  });

  // ... render ...
  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <header className="h-14 flex items-center px-6 shadow-sm border-b border-[#333] shrink-0 bg-[#050505]">
        <div className="flex items-center gap-2 mr-6 border-r border-[#333] pr-6 py-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#a1a1a1]">
            <path fillRule="evenodd" clipRule="evenodd" d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.71 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
            <path d="M14 8.00598C14 10.211 15.794 12.006 18 12.006C20.206 12.006 22 10.211 22 8.00598C22 5.80098 20.206 4.00598 18 4.00598C15.794 4.00598 14 5.80098 14 8.00598Z" opacity="0.5" />
          </svg>
          <span className="font-bold text-[#ededed] text-lg">好友</span>
        </div>

        <div className="flex items-center gap-4">
          <TabButton label="在线" isActive={activeTab === "online"} onClick={() => setActiveTab("online")} />
          <TabButton label="全部" isActive={activeTab === "all"} onClick={() => setActiveTab("all")} />
          <TabButton label="待定" isActive={activeTab === "pending"} onClick={() => setActiveTab("pending")} count={1} />
          <TabButton label="已屏蔽" isActive={activeTab === "blocked"} onClick={() => setActiveTab("blocked")} />
          <button
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ml-2 border 
                      ${activeTab === "add"
                ? "text-[#0070f3] bg-transparent border-[#0070f3]/30"
                : "bg-[#0070f3] text-white border-transparent hover:bg-[#0060df]"}`}
            onClick={() => setActiveTab("add")}
          >
            添加好友
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-0 flex flex-col">
        <div className="flex-1 flex flex-col">
          {activeTab === "add" ? (
            <div className="p-8"><AddFriend /></div>
          ) : (
            <>
              <div className="px-8 mt-6 mb-2">
                <div className="text-xs font-bold text-[#666] uppercase tracking-wider">
                  {activeTab === "online" && `在线 — ${filteredFriends.length}`}
                  {activeTab === "all" && `全部 — ${filteredFriends.length}`}
                  {activeTab === "pending" && `待定 — ${filteredFriends.length}`}
                  {activeTab === "blocked" && `已屏蔽 — ${filteredFriends.length}`}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-2">
                  {filteredFriends.map(friend => (
                    <FriendItem key={friend.id} friend={friend} />
                  ))}
                </div>


                {filteredFriends.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-70">
                    <img src="/empty-friends.svg" alt="" className="w-40 h-40 mb-4 opacity-50 grayscale" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <p className="text-[#666]">这里空空如也...</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Side */}
        <div className="w-[360px] pl-6 hidden xl:block">
          <h3 className="text-xl font-bold text-[#ededed] mb-4">当前活动</h3>
          <div className="bg-[#111] text-center p-8 rounded-lg border border-[#333]">
            <h4 className="text-[#ededed] font-bold mb-2">现在很安静......</h4>
            <p className="text-[#a1a1a1] text-sm">
              当好友开始活动时（比如玩游戏或进行语音聊天的时候），他们的状态都会显示在这里！
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, isActive, onClick, count }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                ${isActive
          ? "bg-[#111] text-white shadow-[0_0_0_1px_#333]"
          : "text-[#a1a1a1] hover:bg-[#111] hover:text-[#ededed]"}`}
    >
      {label}
      {count > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#0070f3] text-white text-[10px]">{count}</span>}
    </button>
  )
}

function FriendItem({ friend }: { friend: Friend }) {
  return (
    <div className="group flex items-center justify-between p-3 rounded-lg hover:bg-[#111] border-t border-[#333]/50 cursor-pointer transition-colors">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={`w-10 h-10 rounded-full ${friend.avatar_url ? '' : 'bg-[#0070f3]'} flex items-center justify-center text-white font-medium`}>
            {friend.avatar_url ? <img src={friend.avatar_url} className="rounded-full" /> : friend.username[0].toUpperCase()}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-[#050505] 
                        ${friend.status === 'online' ? 'bg-green-500' :
              friend.status === 'idle' ? 'bg-yellow-500' :
                friend.status === 'dnd' ? 'bg-red-500' : 'bg-gray-500'}`}>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-white">{friend.username}</span>
            <span className="hidden group-hover:inline text-[#dbdee1] text-xs opacity-60">#{friend.discriminator || "0000"}</span>
          </div>
          <div className="text-xs text-[#949ba4]">
            {friend.status === 'offline' ? '离线' : friend.activity || friend.status}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 bg-[#313338] p-1 rounded">
        <ActionButton icon={<MessageIcon />} tooltip="发消息" />
        <ActionButton icon={<MoreIcon />} tooltip="更多" />
      </div>
    </div>
  )
}

function AddFriend() {
  return (
    <div className="mt-2">
      <h3 className="uppercase text-white font-bold text-sm mb-2">添加好友</h3>
      <p className="text-[#949ba4] text-xs mb-4">你可以使用用户名来添加好友。</p>

      <div className="flex items-center bg-[#1e1f22] p-2 rounded border border-[#1e1f22] focus-within:border-[#5865f2] transition-colors">
        <input
          type="text"
          placeholder="你可以使用用户名来添加好友。 (示例: witw)"
          className="bg-transparent border-none text-white w-full focus:outline-none px-2"
        />
        <button className="bg-[#5865f2] text-white px-4 py-1.5 rounded text-sm font-medium opacity-50 cursor-not-allowed">
          发送好友请求
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center opacity-70">
        <img src="/wumpus-friends.svg" className="w-64 h-40 opacity-50 grayscale" onError={(e) => e.currentTarget.style.display = 'none'} />
        <p className="text-[#949ba4] mt-4">Wumpus 正在等着新的朋友...</p>
      </div>
    </div>
  )
}

function ActionButton({ icon, tooltip }: any) {
  return (
    <div className="w-8 h-8 rounded-full bg-[#2b2d31] flex items-center justify-center text-[#dbdee1] hover:text-white cursor-pointer group/btn relative">
      {icon}
    </div>
  )
}

const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
)

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
)
