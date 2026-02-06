"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PostListItem } from "@/types/blog";
import { getPaginated } from "@/lib/api-client";
import { getCachedJson, setCachedJson } from "@/utils/cache";
import { getListCache, setListCache as setListCacheMemory } from "@/utils/memoryStore";
import { POST_METRICS_UPDATED_EVENT, type PostMetricsUpdateDetail } from "../utils/postMetricsSync";

const CACHE_TTL = 5 * 60 * 1000;


interface UsePostsOptions {
  page?: number;
  pageSize?: number;
  query?: string;
  author?: string;
  tag?: string;
  category?: string;
  token?: string | null;
}

interface PostsResult {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
}

export function usePosts(options: UsePostsOptions) {
  const { page = 1, pageSize = 10, query = "", author = "", tag = "", category = "", token } = options;

  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string>("");

  const buildCacheKey = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(pageSize));
    if (query) params.set("q", query);
    if (author) params.set("author", author);
    if (tag) params.set("tag", tag);
    if (category) params.set("category", category);
    return `cache:blog:${params.toString()}`;
  }, [page, pageSize, query, author, tag, category]);

  const fetchPosts = useCallback(async (force = false) => {
    const cacheKey = buildCacheKey();
    let hasCached = false;

    if (!force) {
      const cached = (getListCache(cacheKey) || getCachedJson<PostsResult>(cacheKey, CACHE_TTL)) as PostsResult | null;
      if (cached && Array.isArray(cached.items) && typeof cached.total === "number") {
        setPosts(cached.items);
        setTotal(cached.total);
        setStatus("success");
        hasCached = true;
      }
    }

    if (!hasCached || force) {
      setStatus("loading");
    }
    setError(null);

    try {
      const params: Record<string, string> = {
        page: String(page),
        size: String(pageSize),
      };
      if (query) params.q = query;
      if (author) params.author = author;
      if (tag) params.tag = tag;
      if (category) params.category = category;

      const headers: Record<string, string> = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      if (token) headers.Authorization = `Bearer ${token}`;

      const result = await getPaginated<PostListItem>("/api/blog", params, { headers });

      setPosts(result.items);
      setTotal(result.total);
      setStatus("success");

      // 鏇存柊缂撳瓨
      const cacheData: PostsResult = {
        items: result.items,
        total: result.total,
        page,
        size: pageSize,
      };
      setCachedJson(cacheKey, cacheData);
      setListCacheMemory(cacheKey, cacheData);
    } catch (err) {
      if (!hasCached || force) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "加载失败");
      }
    }
  }, [buildCacheKey, page, pageSize, query, author, tag, category, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPosts();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPosts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refreshNow = () => {
      void fetchPosts(true);
    };
    // 只监听明确的更新事件，移除 focus 和 visibilitychange 以减少不必要的刷新
    window.addEventListener("blog-updated", refreshNow as EventListener);
    window.addEventListener("profile-updated", refreshNow as EventListener);
    return () => {
      window.removeEventListener("blog-updated", refreshNow as EventListener);
      window.removeEventListener("profile-updated", refreshNow as EventListener);
    };
  }, [fetchPosts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMetricsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PostMetricsUpdateDetail>).detail;
      if (!detail?.slug) return;
      setPosts((prev) =>
        prev.map((item) =>
          item.slug === detail.slug
            ? {
              ...item,
              ...(detail.like_count !== undefined ? { like_count: detail.like_count } : {}),
              ...(detail.dislike_count !== undefined ? { dislike_count: detail.dislike_count } : {}),
              ...(detail.favorite_count !== undefined ? { favorite_count: detail.favorite_count } : {}),
              ...(detail.comment_count !== undefined ? { comment_count: detail.comment_count } : {}),
              ...(detail.favorited_by_me !== undefined ? { favorited_by_me: detail.favorited_by_me } : {}),
            }
            : item
        )
      );
    };
    window.addEventListener(POST_METRICS_UPDATED_EVENT, onMetricsUpdated as EventListener);
    return () => window.removeEventListener(POST_METRICS_UPDATED_EVENT, onMetricsUpdated as EventListener);
  }, []);

  const refresh = useCallback(() => fetchPosts(true), [fetchPosts]);

  const updatePost = useCallback((slug: string, updates: Partial<PostListItem>) => {
    setPosts(prev =>
      prev.map(post =>
        post.slug === slug ? { ...post, ...updates } : post
      )
    );
  }, []);

  return {
    posts,
    total,
    status,
    error,
    refresh,
    updatePost,
    totalPages: Math.ceil(total / pageSize),
  };
}

