"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostCard from "@/components/legacy/PostCard";
import { getFavoritesCache, setFavoritesCache } from "@/utils/memoryStore";
import { getCachedJson, setCachedJson } from "@/utils/cache";
import * as blogService from "@/services/blogService";

export default function FavoritesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("loading");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const router = useRouter();
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "");
    } catch {
      return null;
    }
  })();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const cacheUserKeys = [profile?.username, token, "anon"].filter(Boolean);
  const cacheKeySignature = cacheUserKeys.join("|");
  const localCacheKeys = cacheUserKeys.map((key) => `cache:favorites:${key}:${page}`);

  useEffect(() => {
    const authToken = localStorage.getItem("token");
    if (!authToken) {
      router.push("/login");
      return;
    }
    let cached: any = null;
    for (const key of cacheUserKeys) {
      cached = getFavoritesCache(`${key}:${page}`);
      if (cached) break;
    }
    if (!cached) {
      for (const key of localCacheKeys) {
        cached = getCachedJson(key);
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
      .then((data: any) => {
        const payload = {
          items: Array.isArray(data.items) ? data.items : [],
          total: data.total || 0,
        };
        setItems(payload.items);
        setTotal(payload.total);
        cacheUserKeys.forEach((key) => {
          setFavoritesCache(`${key}:${page}`, payload);
        });
        localCacheKeys.forEach((key) => {
          setCachedJson(key, payload);
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [page, router, cacheKeySignature]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container py-8">
      <div className="page-header mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">我的收藏</h1>
          <p className="text-muted">您收藏的精彩内容</p>
        </div>
        <div className="actions">
          <Link className="btn-ghost" href="/">
            返回主页
          </Link>
        </div>
      </div>
      {status === "error" && <p>加载失败，请稍后再试。</p>}
      {status === "ready" && items.length === 0 && <p>暂无收藏。</p>}
      <div className="list grid">
        {items.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination flex items-center justify-center gap-4 mt-8">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </button>
          <span className="text-muted text-sm">
            第 {page} / {totalPages} 页
          </span>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

