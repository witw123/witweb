"use client";

import { memo } from "react";
import type { PostListItem } from "@/types/blog";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";

interface PostActionsProps {
  post: PostListItem;
  onLike: () => void;
  onDislike: () => void;
  onFavorite: () => void;
  onComment: () => void;
}

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
