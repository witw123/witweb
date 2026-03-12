/**
 * PostActions - 文章操作按钮组件
 *
 * 显示文章的点赞、点踩、收藏、评论按钮及其数量
 * 使用 memo 包装以优化渲染性能
 *
 * @component
 */
"use client";

import { memo } from "react";
import type { PostListItem } from "@/types/blog";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";

/**
 * PostActions 组件属性
 */
interface PostActionsProps {
  /** 文章数据，用于显示数量和收藏状态 */
  post: PostListItem;
  /** 点赞回调 */
  onLike: () => void;
  /** 点踩回调 */
  onDislike: () => void;
  /** 收藏回调 */
  onFavorite: () => void;
  /** 评论回调 */
  onComment: () => void;
}

/**
 * PostActions - 文章操作按钮组件
 *
 * 渲染文章的操作按钮：点赞、点踩、收藏、评论
 * 根据 favorited_by_me 状态显示不同的收藏图标样式
 *
 * @component
 * @example
 * <PostActions
 *   post={post}
 *   onLike={() => handleLike(post)}
 *   onDislike={() => handleDislike(post)}
 *   onFavorite={() => handleFavorite(post)}
 *   onComment={() => handleComment(post.slug)}
 * />
 */
export const PostActions = memo(function PostActions({
  post,
  onLike,
  onDislike,
  onFavorite,
  onComment,
}: PostActionsProps) {
  return (
    <div className="post-card-actions flex gap-1">
      <button
        className="btn-ghost btn-sm"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLike();
        }}
        title="点赞"
      >
        <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
      </button>

      <button
        className="btn-ghost btn-sm"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDislike();
        }}
        title="点踩"
      >
        <ThumbsDownIcon className="inline" /> {post.dislike_count ?? 0}
      </button>

      <button
        className={`btn-ghost btn-sm ${post.favorited_by_me ? "text-accent" : ""}`}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFavorite();
        }}
        title={post.favorited_by_me ? "已收藏" : "收藏"}
      >
        <BookmarkIcon filled={post.favorited_by_me} className="inline" /> {post.favorite_count ?? 0}
      </button>

      <button
        className="btn-ghost btn-sm"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onComment();
        }}
        title="评论"
      >
        <MessageCircleIcon className="inline" /> {post.comment_count ?? 0}
      </button>
    </div>
  );
});
