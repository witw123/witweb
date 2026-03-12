"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { getVersionedApiPath } from "@/lib/api-version";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SuccessResponse } from "@/lib/api-response";
import type { FollowerItem } from "@/types/user";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";

/**
 * FollowersPageContent - 用户粉丝列表页面组件
 *
 * 展示指定用户的粉丝列表，支持查看他人或自己的粉丝。
 * 当前用户可以关注列表中的其他用户。
 *
 * @component
 * @example
 * <FollowersPageContent />
 */

/**
 * readSuccessData - 解析 API 响应数据
 *
 * 从 API 响应中提取成功的数据，仅在响应 success 为 true 时返回数据。
 * 用于统一处理 API 响应格式，避免在多处重复相同的验证逻辑。
 *
 * @template T - 期望的数据类型
 * @param {unknown} payload - API 响应数据
 * @returns {T | null} 解析后的数据，解析失败返回 null
 */
function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

/**
 * FollowersPageContent - 粉丝列表页面内容组件
 *
 * 展示用户的粉丝列表，通过 URL 参数 username 指定要查看的用户。
 * 未指定用户名时展示当前登录用户的粉丝。
 * 支持关注/回关列表中的用户。
 *
 * @component
 * @example
 * <FollowersPageContent /> // 查看自己的粉丝
 * // 或通过 URL /followers?username=john 查看 john 的粉丝
 */
export default function FollowersPageContent() {
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const username = searchParams.get("username");

  const [items, setItems] = useState<FollowerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = username
        ? `${getVersionedApiPath("/followers")}?username=${encodeURIComponent(username)}&page=1&size=50`
        : `${getVersionedApiPath("/followers")}?page=1&size=50`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const payload = readSuccessData<{ items: FollowerItem[] }>(data);
      setItems(payload?.items || []);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleFollow = async (targetUsername: string) => {
    if (!isAuthenticated) return;
    const res = await fetch(getVersionedApiPath("/follow"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    <div className="app-page-shell">
      <div className="app-page-container">
        <div className="app-page-header">
          <h1 className="app-page-title">{username ? `${username} 的粉丝` : "我的粉丝"}</h1>
          <p className="app-page-subtitle">共 {items.length} 人</p>
        </div>

        {loading ? (
          <div className="app-loading-fallback">加载中...</div>
        ) : items.length === 0 ? (
          <div className="card blog-page-card py-16 text-center text-muted">还没有人关注你</div>
        ) : (
          <div className="user-rel-grid">
            {items.map((user) => (
              <div key={user.username} className="user-rel-card">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Link href={`/user/${user.username}`}>
                    {user.avatar_url ? (
                      <FollowerAvatar user={user} />
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
                  {user.is_following ? (
                    <button disabled className="btn-ghost user-rel-btn cursor-default opacity-70">
                      已回关
                    </button>
                  ) : (
                    <button onClick={() => void handleFollow(user.username)} className="btn-primary user-rel-btn justify-center">
                      关注
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FollowerAvatar - 粉丝头像组件
 *
 * 渲染粉丝用户的头像图片，包含懒优化处理。
 * 如果头像 URL 为空，则显示默认的首字母头像。
 *
 * @param {FollowerItem} user - 粉丝用户对象
 * @returns {JSX.Element} 头像图片元素
 */
function FollowerAvatar({ user }: { user: FollowerItem }) {
  const avatarSrc = getThumbnailUrl(user.avatar_url || "", 128);
  const avatarUnoptimized = shouldBypassImageOptimization(avatarSrc);

  return (
    <Image
      src={avatarSrc}
      alt={user.nickname || user.username}
      width={52}
      height={52}
      className="h-14 w-14 rounded-full bg-zinc-800 object-cover"
      unoptimized={avatarUnoptimized}
    />
  );
}

