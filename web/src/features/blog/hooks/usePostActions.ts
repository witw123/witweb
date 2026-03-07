"use client";

import { useCallback, useRef } from "react";
import { getVersionedApiPath } from "@/lib/api-version";
import type { PostListItem } from "@/types/blog";
import { post } from "@/lib/api-client";
import { emitPostMetricsUpdated } from "../utils/postMetricsSync";

interface UsePostActionsOptions {
  isAuthenticated: boolean;
  onUpdate: (slug: string, updates: Partial<PostListItem>) => void;
  onAuthRequired: () => void;
}

interface ActionResult {
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
  like_count: number;
  dislike_count: number;
  favorite_count: number;
  comment_count: number;
}

type LocalState = {
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
};

export function usePostActions({ isAuthenticated, onUpdate, onAuthRequired }: UsePostActionsOptions) {
  const stateRef = useRef<Record<string, LocalState>>({});
  const pendingRef = useRef<Set<string>>(new Set());

  const ensureAuth = useCallback(() => {
    if (!isAuthenticated) {
      onAuthRequired();
      return false;
    }
    return true;
  }, [isAuthenticated, onAuthRequired]);

  const handleAction = useCallback(async (
    slug: string,
    action: "like" | "dislike" | "favorite",
    currentPost: PostListItem
  ): Promise<void> => {
    if (!ensureAuth()) return;

    const pendingKey = `${slug}:${action}`;
    if (pendingRef.current.has(pendingKey)) return;
    pendingRef.current.add(pendingKey);

    const known = stateRef.current[slug] || {};

    const optimisticUpdates: Partial<PostListItem> = {};
    if (action === "like") {
      optimisticUpdates.like_count = (currentPost.like_count ?? 0) + (known.liked === true ? -1 : 1);
    } else if (action === "dislike") {
      optimisticUpdates.dislike_count = (currentPost.dislike_count ?? 0) + (known.disliked === true ? -1 : 1);
    } else {
      const currentFavorited = known.favorited ?? currentPost.favorited_by_me;
      optimisticUpdates.favorite_count = (currentPost.favorite_count ?? 0) + (currentFavorited ? -1 : 1);
      optimisticUpdates.favorited_by_me = !currentFavorited;
    }

    onUpdate(slug, optimisticUpdates);
    emitPostMetricsUpdated({ slug, ...optimisticUpdates });

    try {
      const result = await post<ActionResult>(getVersionedApiPath(`/blog/${slug}/${action}`));

      stateRef.current[slug] = {
        ...stateRef.current[slug],
        ...(result.liked !== undefined ? { liked: result.liked } : {}),
        ...(result.disliked !== undefined ? { disliked: result.disliked } : {}),
        ...(result.favorited !== undefined ? { favorited: result.favorited } : {}),
      };

      const updates = {
        like_count: result.like_count,
        dislike_count: result.dislike_count,
        favorite_count: result.favorite_count,
        comment_count: result.comment_count,
        favorited_by_me: result.favorited ?? currentPost.favorited_by_me,
      };

      onUpdate(slug, updates);
      emitPostMetricsUpdated({ slug, ...updates });
    } catch {
      onUpdate(slug, currentPost);
      emitPostMetricsUpdated({
        slug,
        like_count: currentPost.like_count,
        dislike_count: currentPost.dislike_count,
        favorite_count: currentPost.favorite_count,
        comment_count: currentPost.comment_count,
        favorited_by_me: currentPost.favorited_by_me,
      });
    } finally {
      pendingRef.current.delete(pendingKey);
    }
  }, [ensureAuth, onUpdate]);

  const like = useCallback((post: PostListItem) =>
    handleAction(post.slug, "like", post),
  [handleAction]);

  const dislike = useCallback((post: PostListItem) =>
    handleAction(post.slug, "dislike", post),
  [handleAction]);

  const favorite = useCallback((post: PostListItem) =>
    handleAction(post.slug, "favorite", post),
  [handleAction]);

  return {
    like,
    dislike,
    favorite,
  };
}
