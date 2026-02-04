"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function FollowersPageContent() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const username = searchParams.get("username");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    try {
      const url = username
        ? `/api/followers?username=${encodeURIComponent(username)}&page=1&size=50`
        : `/api/followers?page=1&size=50`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [token, username]);

  const handleFollow = async (targetUsername: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: targetUsername }),
      });
      if (res.ok) {
        setItems(prev => prev.map(item =>
          item.username === targetUsername ? { ...item, is_following: true } : item
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {username ? `${username} 的粉丝` : "我的粉丝"}
        </h1>
        <span className="text-zinc-500 text-sm">({items.length})</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-xl">
          <p className="text-zinc-500 text-lg">还没有人关注哦~</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((user) => (
            <div key={user.username} className="bg-[#1e1e1e] border border-zinc-800/50 rounded-lg p-4 flex items-center justify-between hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Link href={`/user/${user.username}`}>
                  <div className="flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} className="w-14 h-14 rounded-full object-cover bg-zinc-800" alt="" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-lg font-bold">
                        {user.nickname?.[0] || user.username?.[0]}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0 pr-4">
                  <Link href={`/user/${user.username}`} className="hover:text-blue-400 transition-colors inline-block max-w-full">
                    <h2 className="font-bold text-[15px] text-white truncate">{user.nickname || user.username}</h2>
                  </Link>
                  <p className="text-zinc-400 text-xs mt-1 truncate">
                    {user.bio || "这个人很懒，什么都没有写~"}
                  </p>
                  <div className="flex gap-3 text-[11px] text-zinc-500 mt-2 font-medium uppercase tracking-wider">
                    <span>关注 {user.following_count}</span>
                    <span>粉丝 {user.follower_count}</span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                {user.is_following ? (
                  <button
                    disabled
                    className="flex items-center gap-1.5 bg-zinc-800/50 text-zinc-500 px-4 py-1.5 rounded-md text-[13px] font-medium cursor-default border border-zinc-700/30"
                  >
                    {user.is_mutual ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 2.1l4 4-4 4"></path>
                        <path d="M3 12.2v-2a4 4 0 0 1 4-4h14"></path>
                        <path d="M7 21.9l-4-4 4-4"></path>
                        <path d="M21 11.8v2a4 4 0 0 1-4 4H3"></path>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                    {user.is_mutual ? "已互粉" : "已关注"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleFollow(user.username)}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-5 py-1.5 rounded-full text-[13px] font-bold hover:bg-blue-500 shadow-[0_4px_10px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_15px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    回关
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
