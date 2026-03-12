"use client";

/**
 * 文章操作 Hook
 *
 * 统一封装点赞、点踩、收藏三类交互的鉴权、乐观更新和回滚逻辑。
 * 这样列表项组件只需要关心“触发哪个动作”，无需各自维护请求状态。
 */

import { useCallback, useRef } from "react";
import { getVersionedApiPath } from "@/lib/api-version";
import type { PostListItem } from "@/types/blog";
import { post } from "@/lib/api-client";
import { emitPostMetricsUpdated } from "../utils/postMetricsSync";

/** 文章操作选项。 */
interface UsePostActionsOptions {
  isAuthenticated: boolean;
  onUpdate: (slug: string, updates: Partial<PostListItem>) => void;
  onAuthRequired: () => void;
}

/** 服务端返回的动作结果。 */
interface ActionResult {
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
  like_count: number;
  dislike_count: number;
  favorite_count: number;
  comment_count: number;
}

/** 当前页面缓存中的本地交互状态。 */
type LocalState = {
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
};

/**
 * 提供文章操作能力
 *
 * @param {UsePostActionsOptions} options - Hook 配置
 * @returns {object} 包含点赞、点踩、收藏方法的对象
 */
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
    // 同一篇文章的同一动作未完成前不重复发送，避免连点导致计数抖动。
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

      // 持久化服务端确认后的状态，供下一次乐观更新计算基线使用。
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
      // 请求失败时回滚到当前卡片原始值，保证 UI 与实际状态重新对齐。
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
