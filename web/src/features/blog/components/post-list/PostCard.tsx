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
    <article className="card post-card-item post-row-card block text-inherit no-underline">
      <div className="post-row-meta">
        <time className="post-row-date" dateTime={post.created_at}>
          {new Date(post.created_at).toLocaleDateString()}
        </time>
        <UserHoverCard username={post.author}>
          <div className="author post-row-author flex items-center gap-2">
            {effectiveAvatar ? (
              <Image
                src={avatarUrl}
                alt={post.author_name}
                width={34}
                height={34}
                loading="lazy"
                className="h-[34px] w-[34px] rounded-full"
                unoptimized
              />
            ) : (
              <div className="avatar-fallback h-[34px] w-[34px] text-sm">{post.author_name?.[0] || "U"}</div>
            )}
            <span className="text-base font-semibold leading-none">{post.author_name || post.author || "匿名用户"}</span>
          </div>
        </UserHoverCard>
      </div>

      <div className="post-row-content">
      <Link href={`/post/${post.slug}`} className="post-card-link post-card-main block text-inherit no-underline">
        {post.category_name && (
          <div className="category-row mb-2">
            <span className="category-chip">{post.category_name}</span>
          </div>
        )}
        <h2 className="post-card-title mb-3 line-clamp-2 text-xl font-bold leading-tight">
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

        <p className="excerpt post-card-excerpt mb-1 line-clamp-2 text-sm leading-relaxed text-muted">{preview}</p>
      </Link>

      <div className="post-card-footer mt-auto flex items-center justify-between gap-4">
        {tagList.length > 0 && (
          <div className="tag-list post-inline-tags">
            {tagList.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-pill">
                #{tag}
              </span>
            ))}
            {tagList.length > 3 && <span className="tag-pill tag-pill-more">+{tagList.length - 3}</span>}
          </div>
        )}
        <PostActions
          post={post}
          onLike={() => onLike(post)}
          onDislike={() => onDislike(post)}
          onFavorite={() => onFavorite(post)}
          onComment={() => onCommentClick(post.slug)}
        />
      </div>
      </div>
    </article>
  );
});
