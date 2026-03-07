"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getVersionedApiPath } from "@/lib/api-version";
import type { PostListItem } from "@/types/blog";
import { getPaginated } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  POST_METRICS_UPDATED_EVENT,
  type PostMetricsUpdateDetail,
} from "../utils/postMetricsSync";

interface UsePostsOptions {
  page?: number;
  pageSize?: number;
  query?: string;
  author?: string;
  tag?: string;
  category?: string;
}

interface PostsResult {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
}

export function usePosts(options: UsePostsOptions) {
  const {
    page = 1,
    pageSize = 10,
    query = "",
    author = "",
    tag = "",
    category = "",
  } = options;

  const queryClient = useQueryClient();

  const postsQueryKey = useMemo(
    () =>
      queryKeys.postsList({
        page,
        pageSize,
        query,
        author,
        tag,
        category,
      }),
    [page, pageSize, query, author, tag, category]
  );

  const postsQuery = useQuery({
    queryKey: postsQueryKey,
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        size: String(pageSize),
      };

      if (query) params.q = query;
      if (author) params.author = author;
      if (tag) params.tag = tag;
      if (category) params.category = category;

      const result = await getPaginated<PostListItem>(
        getVersionedApiPath("/blog"),
        params
      );

      return {
        items: result.items,
        total: result.total,
        page,
        size: pageSize,
      } satisfies PostsResult;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshNow = () => {
      void queryClient.invalidateQueries({ queryKey: postsQueryKey });
    };

    window.addEventListener("blog-updated", refreshNow as EventListener);
    window.addEventListener("profile-updated", refreshNow as EventListener);

    return () => {
      window.removeEventListener("blog-updated", refreshNow as EventListener);
      window.removeEventListener("profile-updated", refreshNow as EventListener);
    };
  }, [postsQueryKey, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMetricsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PostMetricsUpdateDetail>).detail;
      if (!detail?.slug) return;

      queryClient.setQueryData<PostsResult>(postsQueryKey, (current) => {
        if (!current) return current;
        const next = current.items.map((item) =>
          item.slug === detail.slug
            ? {
                ...item,
                ...(detail.like_count !== undefined
                  ? { like_count: detail.like_count }
                  : {}),
                ...(detail.dislike_count !== undefined
                  ? { dislike_count: detail.dislike_count }
                  : {}),
                ...(detail.favorite_count !== undefined
                  ? { favorite_count: detail.favorite_count }
                  : {}),
                ...(detail.comment_count !== undefined
                  ? { comment_count: detail.comment_count }
                  : {}),
                ...(detail.favorited_by_me !== undefined
                  ? { favorited_by_me: detail.favorited_by_me }
                  : {}),
              }
            : item
        );
        return { ...current, items: next };
      });
    };

    window.addEventListener(
      POST_METRICS_UPDATED_EVENT,
      onMetricsUpdated as EventListener
    );

    return () =>
      window.removeEventListener(
        POST_METRICS_UPDATED_EVENT,
        onMetricsUpdated as EventListener
      );
  }, [postsQueryKey, queryClient]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: postsQueryKey }),
    [postsQueryKey, queryClient]
  );

  const updatePost = useCallback(
    (slug: string, updates: Partial<PostListItem>) => {
      queryClient.setQueryData<PostsResult>(postsQueryKey, (current) => {
        if (!current) return current;
        const next = current.items.map((post) =>
          post.slug === slug ? { ...post, ...updates } : post
        );
        return { ...current, items: next };
      });
    },
    [postsQueryKey, queryClient]
  );

  const status =
    postsQuery.status === "pending" ? "loading" : postsQuery.status;
  const posts = postsQuery.data?.items || [];

  return {
    posts,
    total: postsQuery.data?.total || 0,
    status,
    error: postsQuery.error instanceof Error ? postsQuery.error.message : null,
    refresh,
    updatePost,
    totalPages: Math.ceil((postsQuery.data?.total || 0) / pageSize),
  };
}
