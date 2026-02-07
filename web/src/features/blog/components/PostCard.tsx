"use client";

import Image from "next/image";
import Link from "next/link";
import { getThumbnailUrl } from "@/utils/url";
import { ThumbsUpIcon, MessageCircleIcon, BookmarkIcon, ThumbsDownIcon } from "@/components/Icons";
import UserHoverCard from "@/features/blog/components/UserHoverCard";

export default function PostCard({
  post,
  showActions = false,
  onLike,
  onDislike,
  onFavorite,
  onDelete,
  canEdit = false,
}: {
  post: any;
  showActions?: boolean;
  onLike?: (post: any) => void;
  onDislike?: (post: any) => void;
  onFavorite?: (post: any) => void;
  onDelete?: (post: any) => void;
  canEdit?: boolean;
}) {
  const tagList = (post.tags || "")
    .split(/[,，]/)
    .filter(Boolean)
    .map((t: string) => t.trim());
  const avatarUrl = getThumbnailUrl(post.author_avatar, 64);

  return (
    <article className="card post-card post-card-item">
      <div className="card-head post-card-head mb-2 flex items-start justify-between">
        <UserHoverCard username={post.author} className="z-10">
          <div className="author flex items-center gap-2">
            {post.author_avatar ? (
              <Image
                src={avatarUrl}
                alt={post.author_name || post.author}
                width={24}
                height={24}
                loading="lazy"
                className="h-6 w-6 rounded-full"
                unoptimized
              />
            ) : (
              <div className="avatar-fallback flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs">
                {(post.author_name || post.author || "U")?.[0]}
              </div>
            )}
            <span className="text-sm font-medium uppercase">{post.author_name || post.author || "匿名"}</span>
          </div>
        </UserHoverCard>
        <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
      </div>

      <Link href={`/post/${post.slug}`} className="post-card-link post-card-main block">
        <h2 className="post-card-title mb-2 line-clamp-2 text-xl font-bold leading-tight">{post.title}</h2>

        <p className="excerpt post-card-excerpt mb-4 text-sm leading-relaxed text-muted line-clamp-3">
          {(post.content || "").replace(/\s+/g, " ").trim().slice(0, 140)}
        </p>
      </Link>

      <div className="post-card-footer mt-auto flex items-center justify-between gap-4">
        <div className="tag-list">
          {tagList.slice(0, 3).map((tag: string) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
          ))}
        </div>

        {showActions ? (
          <div className="post-card-actions flex gap-1">
            {onLike && (
              <button
                className="btn-ghost btn-sm"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onLike(post);
                }}
              >
                <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
              </button>
            )}
            {onDislike && (
              <button
                className="btn-ghost btn-sm"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onDislike(post);
                }}
              >
                <ThumbsDownIcon className="inline" /> {post.dislike_count ?? 0}
              </button>
            )}
            {onFavorite && (
              <button
                className={`btn-ghost btn-sm ${post.favorited_by_me ? "text-accent" : ""}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onFavorite(post);
                }}
              >
                <BookmarkIcon filled={post.favorited_by_me} className="inline" /> {post.favorite_count ?? 0}
              </button>
            )}
            {canEdit && onDelete && (
              <button
                className="btn-ghost btn-sm text-accent"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(post);
                }}
              >
                删除
              </button>
            )}
          </div>
        ) : (
          <div className="post-card-actions flex gap-1">
            <span className="flex items-center gap-1 text-sm text-muted">
              <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
            </span>
            <span className="flex items-center gap-1 text-sm text-muted">
              <MessageCircleIcon className="inline" /> {post.comment_count ?? 0}
            </span>
            <span className="flex items-center gap-1 text-sm text-muted">
              <BookmarkIcon className="inline" /> {post.favorite_count ?? 0}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
