"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import type { PostListItem } from "@/types/blog";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";
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
  const avatarUnoptimized = shouldBypassImageOptimization(avatarUrl);

  const coverUrl = post.cover_image_url;
  const coverUnoptimized = coverUrl ? shouldBypassImageOptimization(coverUrl) : false;

  return (
    <article className="post-card-v2">
      {/* Cover image area */}
      <Link href={`/post/${post.slug}`} className="post-card-v2-cover-link">
        {coverUrl ? (
          <div className="post-card-v2-cover">
            <Image
              src={coverUrl}
              alt={titleText}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
              unoptimized={coverUnoptimized}
            />
          </div>
        ) : (
          <div className="post-card-v2-cover post-card-v2-cover-empty">
            <span className="post-card-v2-cover-icon">📄</span>
          </div>
        )}
      </Link>

      {/* Content body */}
      <div className="post-card-v2-body">
        {/* Top row: author + category */}
        <div className="post-card-v2-topbar">
          <UserHoverCard username={post.author}>
            <div className="post-card-v2-author">
              {effectiveAvatar ? (
                <Image
                  src={avatarUrl}
                  alt={post.author_name}
                  width={22}
                  height={22}
                  loading="lazy"
                  className="post-card-v2-avatar"
                  unoptimized={avatarUnoptimized}
                />
              ) : (
                <div className="avatar-fallback post-card-v2-avatar-fallback">
                  {post.author_name?.[0] || "U"}
                </div>
              )}
              <span className="post-card-v2-author-name">
                {post.author_name || post.author || "匿名用户"}
              </span>
            </div>
          </UserHoverCard>
          {post.category_name && (
            <span className="category-chip">{post.category_name}</span>
          )}
        </div>

        {/* Title */}
        <Link href={`/post/${post.slug}`} className="post-card-v2-title-link">
          <h2 className="post-card-v2-title">
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
        </Link>

        {/* Tags */}
        {tagList.length > 0 && (
          <div className="post-card-v2-tags">
            {tagList.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-pill">#{tag}</span>
            ))}
            {tagList.length > 3 && <span className="tag-pill tag-pill-more">+{tagList.length - 3}</span>}
          </div>
        )}

        {/* Footer: date left, actions right */}
        <div className="post-card-v2-footer">
          <time className="post-card-v2-date" dateTime={post.created_at}>
            {new Date(post.created_at).toLocaleDateString()}
          </time>
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
