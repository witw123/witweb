"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post as postRequest } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import type { CommentListItem, PostDetail } from "@/types";
import { useCategories } from "./useCategories";
import {
  emitPostMetricsUpdated,
  POST_METRICS_UPDATED_EVENT,
  type PostMetricsUpdateDetail,
} from "../utils/postMetricsSync";

type PostCacheStatus = "loading" | "error" | "ready";

type UsePostCacheInput = {
  slug?: string;
  isAuthenticated: boolean;
};

type UsePostCacheResult = {
  post: PostDetail | null;
  setPost: (value: PostDetail | null | ((previous: PostDetail | null) => PostDetail | null)) => void;
  comments: CommentListItem[];
  setComments: (
    value:
      | CommentListItem[]
      | ((previous: CommentListItem[]) => CommentListItem[])
  ) => void;
  categories: ReturnType<typeof useCategories>["categories"];
  status: PostCacheStatus;
  commentListStatus: PostCacheStatus;
  refreshPost: () => Promise<void>;
  refreshComments: () => Promise<void>;
};

export function usePostCache({
  slug,
  isAuthenticated,
}: UsePostCacheInput): UsePostCacheResult {
  const queryClient = useQueryClient();
  const { categories } = useCategories();

  const postQuery = useQuery({
    queryKey: slug ? queryKeys.postDetail(slug) : ["post-detail", "missing"],
    queryFn: async () => get<PostDetail>(getVersionedApiPath(`/blog/${slug}`)),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const commentsQuery = useQuery({
    queryKey: slug ? queryKeys.postComments(slug) : ["post-comments", "missing"],
    queryFn: async () => get<CommentListItem[]>(getVersionedApiPath(`/blog/${slug}/comments`)),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const refreshPost = useCallback(async () => {
    if (!slug) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.postDetail(slug) });
  }, [queryClient, slug]);

  const refreshComments = useCallback(async () => {
    if (!slug) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.postComments(slug) });
  }, [queryClient, slug]);

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;
    const handler = () => {
      void refreshPost();
      void refreshComments();
    };
    window.addEventListener("profile-updated", handler as EventListener);
    window.addEventListener("blog-updated", handler as EventListener);
    return () => {
      window.removeEventListener("profile-updated", handler as EventListener);
      window.removeEventListener("blog-updated", handler as EventListener);
    };
  }, [refreshComments, refreshPost, slug]);

  useEffect(() => {
    if (!slug || typeof window === "undefined" || !isAuthenticated) return;
    const viewedKey = `post:viewed:${slug}`;
    if (sessionStorage.getItem(viewedKey)) return;

    void postRequest<{ view_count: number }>(getVersionedApiPath(`/blog/${slug}/view`))
      .then((data) => {
        sessionStorage.setItem(viewedKey, "1");
        if (typeof data.view_count === "number") {
          queryClient.setQueryData<PostDetail | null>(queryKeys.postDetail(slug), (previous) =>
            previous ? { ...previous, view_count: data.view_count } : previous
          );
        }
      })
      .catch(() => undefined);
  }, [isAuthenticated, queryClient, slug]);

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;
    const onMetricsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PostMetricsUpdateDetail>).detail;
      if (!detail?.slug || detail.slug !== slug) return;

      queryClient.setQueryData<PostDetail | null>(queryKeys.postDetail(slug), (previous) => {
        if (!previous) return previous;
        const next = {
          ...previous,
          ...(detail.like_count !== undefined ? { like_count: detail.like_count } : {}),
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
        };
        return next;
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
  }, [queryClient, slug]);

  const post = postQuery.data || null;
  const comments = commentsQuery.data || [];

  useEffect(() => {
    if (!slug || !post) return;
    emitPostMetricsUpdated({
      slug,
      like_count: post.like_count,
      dislike_count: post.dislike_count,
      favorite_count: post.favorite_count,
      comment_count: post.comment_count,
      favorited_by_me: post.favorited_by_me,
    });
  }, [
    post?.comment_count,
    post?.dislike_count,
    post?.favorite_count,
    post?.favorited_by_me,
    post?.like_count,
    post,
    slug,
  ]);

  const setPost = useCallback(
    (value: PostDetail | null | ((previous: PostDetail | null) => PostDetail | null)) => {
      if (!slug) return;
      queryClient.setQueryData<PostDetail | null>(
        queryKeys.postDetail(slug),
        typeof value === "function"
          ? (previous) => value((previous as PostDetail | null | undefined) ?? null)
          : value
      );
    },
    [queryClient, slug]
  );

  const setComments = useCallback(
    (
      value:
        | CommentListItem[]
        | ((previous: CommentListItem[]) => CommentListItem[])
    ) => {
      if (!slug) return;
      queryClient.setQueryData<CommentListItem[]>(
        queryKeys.postComments(slug),
        typeof value === "function"
          ? (previous) => value((previous as CommentListItem[] | undefined) ?? [])
          : value
      );
    },
    [queryClient, slug]
  );

  const status: PostCacheStatus =
    postQuery.status === "pending"
      ? "loading"
      : postQuery.status === "error"
        ? "error"
        : "ready";

  const commentListStatus: PostCacheStatus =
    commentsQuery.status === "pending"
      ? "loading"
      : commentsQuery.status === "error"
        ? "error"
        : "ready";

  return {
    post,
    setPost,
    comments,
    setComments,
    categories,
    status,
    commentListStatus,
    refreshPost,
    refreshComments,
  };
}
