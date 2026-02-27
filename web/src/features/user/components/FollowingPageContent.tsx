"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SuccessResponse } from "@/lib/api-response";
import type { FollowingItem } from "@/types/user";

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

export default function FollowingPageContent() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const username = searchParams.get("username");

  const [items, setItems] = useState<FollowingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = username
        ? `/api/following?username=${encodeURIComponent(username)}&page=1&size=50`
        : `/api/following?page=1&size=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      const payload = readSuccessData<{ items: FollowingItem[] }>(data);
      setItems(payload?.items || []);
    } finally {
      setLoading(false);
    }
  }, [token, username]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleUnfollow = async (targetUsername: string) => {
    if (!token) return;
    if (!confirm("确定要取消关注吗？")) return;
    const res = await fetch(`/api/follow/${targetUsername}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.username !== targetUsername));
    }
  };

  return (
    <div className="app-page-shell">
      <div className="app-page-container">
        <div className="app-page-header">
          <h1 className="app-page-title">{username ? `${username} 的关注` : "我的关注"}</h1>
          <p className="app-page-subtitle">共 {items.length} 人</p>
        </div>

        {loading ? (
          <div className="app-loading-fallback">加载中...</div>
        ) : items.length === 0 ? (
          <div className="card blog-page-card py-16 text-center text-muted">你还没有关注任何人</div>
        ) : (
          <div className="user-rel-grid">
            {items.map((user) => (
              <div key={user.username} className="user-rel-card">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Link href={`/user/${user.username}`}>
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.nickname || user.username}
                        width={52}
                        height={52}
                        className="h-14 w-14 rounded-full bg-zinc-800 object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold text-zinc-400">
                        {user.nickname?.[0] || user.username?.[0]}
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/user/${user.username}`} className="inline-block max-w-full transition-colors hover:text-blue-400">
                      <h2 className="truncate text-[15px] font-bold text-white">{user.nickname || user.username}</h2>
                    </Link>
                    <p className="mt-1 truncate text-xs text-zinc-400">{user.bio || "这个人很懒，什么都没写"}</p>
                    <div className="mt-2 flex gap-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      <span>关注 {user.following_count}</span>
                      <span>粉丝 {user.follower_count}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <button onClick={() => void handleUnfollow(user.username)} className="btn-ghost user-rel-btn justify-center">
                    {user.is_mutual ? "已互相关注" : "已关注"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

