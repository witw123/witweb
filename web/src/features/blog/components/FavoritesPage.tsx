"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import type { UserProfile as AuthUserProfile } from "@/app/providers";
import { PostCard } from "@/features/blog/components/post-list/PostCard";
import { Pagination } from "@/features/blog/components/pagination/Pagination";
import { usePostActions } from "@/features/blog/hooks";
import { clearAllCaches, getFavoritesCache, setFavoritesCache } from "@/utils/memoryStore";
import { getCachedJson, setCachedJson } from "@/utils/cache";
import * as blogService from "@/services/blogService";
import type { PostListItem } from "@/types/blog";

type FavoritesCachePayload = {
  items: PostListItem[];
  total: number;
};

export default function FavoritesPage() {
  const [items, setItems] = useState<PostListItem[]>([]);
  const [status, setStatus] = useState("loading");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const router = useRouter();
  const { user, token } = useAuth();

  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "") as AuthUserProfile;
    } catch {
      return null;
    }
  })();

  const cacheUserKeys = useMemo(() => [profile?.username, token, "anon"].filter(Boolean), [profile?.username, token]);
  const cacheKeySignature = useMemo(() => cacheUserKeys.join("|"), [cacheUserKeys]);
  const localCacheKeys = useMemo(
    () => cacheUserKeys.map((key) => `cache:favorites:${key}:${page}`),
    [cacheUserKeys, page]
  );

  const loadFavorites = useCallback(() => {
    const authToken = localStorage.getItem("token");
    if (!authToken) {
      router.push("/login");
      return;
    }

    let cached: FavoritesCachePayload | null = null;
    for (const key of cacheUserKeys) {
      cached = (getFavoritesCache(`${key}:${page}`) as FavoritesCachePayload | null) || null;
      if (cached) break;
    }

    if (!cached) {
      for (const key of localCacheKeys) {
        cached = (getCachedJson(key) as FavoritesCachePayload | null) || null;
        if (cached) break;
      }
    }

    if (cached) {
      setItems(Array.isArray(cached.items) ? cached.items : []);
      setTotal(cached.total || 0);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    blogService
      .getFavorites(page, pageSize)
      .then((data) => {
        const payload = {
          items: Array.isArray(data.items) ? data.items : [],
          total: data.total || 0,
        } satisfies FavoritesCachePayload;
        setItems(payload.items);
        setTotal(payload.total);
        cacheUserKeys.forEach((key) => setFavoritesCache(`${key}:${page}`, payload));
        localCacheKeys.forEach((key) => setCachedJson(key, payload));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [cacheUserKeys, localCacheKeys, page, pageSize, router]);

  const updatePost = useCallback((slug: string, updates: Partial<PostListItem>) => {
    setItems((prev) => prev.map((item) => (item.slug === slug ? { ...item, ...updates } : item)));
  }, []);

  const { like, dislike, favorite } = usePostActions({
    token,
    onUpdate: updatePost,
    onAuthRequired: () => router.push("/login"),
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFavorites();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadFavorites]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      clearAllCaches();
      try {
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("cache:blog:") ||
            key.startsWith("cache:post:") ||
            key.startsWith("cache:comments:") ||
            key.startsWith("cache:favorites:") ||
            key.startsWith("cache:profile:")
          ) {
            localStorage.removeItem(key);
          }
        });
      } catch {}
      loadFavorites();
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [cacheKeySignature, loadFavorites]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container blog-page-shell">
      <div className="blog-page-header">
        <div>
          <h1 className="blog-page-title">我的收藏</h1>
          <p className="blog-page-subtitle">你收藏的文章都在这里。</p>
        </div>
        <div className="actions">
          <Link className="btn-ghost" href="/">
            返回首页
          </Link>
        </div>
      </div>

      {status === "error" && <p>加载失败，请稍后重试。</p>}
      {status === "ready" && items.length === 0 && <p>暂无收藏。</p>}

      <div className="list grid gap-4">
        {items.map((post) => (
          <PostCard
            key={post.slug}
            post={post}
            currentUser={user ? { username: user.username, avatar_url: user.avatar_url } : null}
            onLike={like}
            onDislike={dislike}
            onFavorite={favorite}
            onCommentClick={(slug) => router.push(`/post/${slug}#comments`)}
          />
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
