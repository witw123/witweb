"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import type { PostListItem } from "@/types/blog";
import { getThumbnailUrl } from "@/utils/url";
import UserHoverCard from "../UserHoverCard";
import { PostActions } from "./PostActions";

interface PostCardProps {
  post: PostListItem;
  highlightQuery?: string;
  currentUser?: {
    username: string;
    avatar_url?: string;
  } | null;
  onLike: (post: PostListItem) => void;
  onDislike: (post: PostListItem) => void;
  onFavorite: (post: PostListItem) => void;
  onCommentClick: (slug: string) => void;
}

export const PostCard = memo(function PostCard({
  post,
  highlightQuery = "",
  currentUser,
  onLike,
  onDislike,
  onFavorite,
  onCommentClick,
}: PostCardProps) {
  const titleText = post.title || "";
  const rawPreview = (post.content || "").replace(/\s+/g, " ").trim();
  const preview =
    rawPreview.length > 0
      ? `${rawPreview.slice(0, 160)}${rawPreview.length > 160 ? "..." : ""}`
      : "暂无预览";

  const tagList = (post.tags || "")
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const normalized = highlightQuery.trim().toLowerCase();
  const matchIndex = normalized ? titleText.toLowerCase().indexOf(normalized) : -1;

  const effectiveAvatar =
    post.author === currentUser?.username && currentUser?.avatar_url
      ? currentUser.avatar_url
      : post.author_avatar;
  const avatarUrl = getThumbnailUrl(effectiveAvatar || "", 64);

  return (
    <div className="card block no-underline text-inherit">
      <div className="card-head mb-3 flex items-start justify-between">
        <UserHoverCard username={post.author}>
          <div className="author flex items-center gap-2">
            {effectiveAvatar ? (
              <Image
                src={avatarUrl}
                alt={post.author_name}
                width={24}
                height={24}
                loading="lazy"
                className="h-6 w-6 rounded-full"
                unoptimized
              />
            ) : (
              <div className="avatar-fallback h-6 w-6 text-xs">{post.author_name?.[0] || "U"}</div>
            )}
            <span className="text-sm font-medium">{post.author_name || post.author || "未知作者"}</span>
          </div>
        </UserHoverCard>
        <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
      </div>

      <Link href={`/post/${post.slug}`} className="block no-underline text-inherit">
        <h2 className="mb-3 text-xl font-bold leading-tight">
          {matchIndex >= 0 ? (
            <>
              {titleText.slice(0, matchIndex)}
              <span className="highlight">
                {titleText.slice(matchIndex, matchIndex + normalized.length)}
              </span>
              {titleText.slice(matchIndex + normalized.length)}
            </>
          ) : (
            titleText
          )}
        </h2>

        <p className="excerpt mb-6 line-clamp-2 text-sm leading-relaxed text-muted">{preview}</p>
      </Link>

      <div className="post-card-footer mt-auto flex items-center justify-between">
        <div className="post-meta-stack">
          {post.category_name && (
            <div className="category-row">
              <span className="category-chip">{post.category_name}</span>
            </div>
          )}
          {tagList.length > 0 && (
            <div className="tag-list">
              {tagList.map((tag) => (
                <span key={tag} className="tag-pill">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <PostActions
          post={post}
          onLike={() => onLike(post)}
          onDislike={() => onDislike(post)}
          onFavorite={() => onFavorite(post)}
          onComment={() => onCommentClick(post.slug)}
        />
      </div>
    </div>
  );
});
