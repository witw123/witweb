"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function FollowersPageContent() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const username = searchParams.get("username");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = username
        ? `/api/followers?username=${encodeURIComponent(username)}&page=1&size=50`
        : `/api/followers?page=1&size=50`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      setItems(data.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [token, username]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleFollow = async (targetUsername: string) => {
    if (!token) return;
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: targetUsername }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((item) => (item.username === targetUsername ? { ...item, is_following: true } : item))
      );
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {username ? `${username} 的粉丝` : "我的粉丝"}
        </h1>
        <span className="text-sm text-zinc-500">({items.length})</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-blue-500"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-24 text-center">
          <p className="text-lg text-zinc-500">还没有人关注你</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((user) => (
            <div
              key={user.username}
              className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-[#1e1e1e] p-4 transition-colors hover:border-zinc-700"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Link href={`/user/${user.username}`}>
                  <div className="flex-shrink-0">
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.nickname || user.username}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-full bg-zinc-800 object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold text-zinc-400">
                        {user.nickname?.[0] || user.username?.[0]}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1 pr-4">
                  <Link href={`/user/${user.username}`} className="inline-block max-w-full transition-colors hover:text-blue-400">
                    <h2 className="truncate text-[15px] font-bold text-white">{user.nickname || user.username}</h2>
                  </Link>
                  <p className="mt-1 truncate text-xs text-zinc-400">
                    {user.bio || "这个人很懒，什么都没写"}
                  </p>
                  <div className="mt-2 flex gap-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    <span>关注 {user.following_count}</span>
                    <span>粉丝 {user.follower_count}</span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                {user.is_following ? (
                  <button
                    disabled
                    className="flex cursor-default items-center gap-1.5 rounded-md border border-zinc-700/30 bg-zinc-800/50 px-4 py-1.5 text-[13px] font-medium text-zinc-500"
                  >
                    {user.is_mutual ? "已互相关注" : "已关注"}
                  </button>
                ) : (
                  <button
                    onClick={() => void handleFollow(user.username)}
                    className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-1.5 text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-[0_6px_15px_rgba(37,99,235,0.3)]"
                  >
                    关注
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
