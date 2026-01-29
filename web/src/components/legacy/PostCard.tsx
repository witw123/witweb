"use client";

import Link from "next/link";
import { getThumbnailUrl } from "@/utils/url";
import { ThumbsUpIcon, MessageCircleIcon, BookmarkIcon } from "@/components/Icons";

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
  const tagList = (post.tags || "").split(",").filter(Boolean).map((t: string) => t.trim());
  const avatarUrl = getThumbnailUrl(post.author_avatar, 64);

  return (
    <Link href={`/post/${post.slug}`} className="post-card">
      <div className="card-head flex justify-between items-start mb-2">
        <div className="author flex items-center gap-2">
          {post.author_avatar ? (
            <img
              src={avatarUrl}
              alt={post.author_name || post.author}
              loading="lazy"
              decoding="async"
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="avatar-fallback w-6 h-6 flex items-center justify-center rounded-full bg-secondary text-xs">
              {(post.author_name || post.author || "U")?.[0]}
            </div>
          )}
          <span className="text-sm font-medium">{post.author_name || post.author || "匿名"}</span>
        </div>
        <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
      </div>

      <h2 className="text-xl font-bold mb-2 leading-tight">{post.title}</h2>

      <p className="excerpt text-muted text-sm mb-4 line-clamp-2 leading-relaxed">
        {(post.content || "").replace(/\s+/g, " ").trim().slice(0, 140)}
      </p>

      <div className="post-card-footer flex justify-between items-center mt-auto">
        <div className="tag-list">
          {tagList.slice(0, 3).map((tag: string) => (
            <span key={tag} className="tag-pill">#{tag}</span>
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
                <ThumbsUpIcon className="inline" /> {post.dislike_count ?? 0}
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
            <span className="text-sm text-muted flex items-center gap-1">
              <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
            </span>
            <span className="text-sm text-muted flex items-center gap-1">
              <MessageCircleIcon className="inline" /> {post.comment_count ?? 0}
            </span>
            <span className="text-sm text-muted flex items-center gap-1">
              <BookmarkIcon className="inline" /> {post.favorite_count ?? 0}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
