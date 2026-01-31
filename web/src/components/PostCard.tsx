"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";
import { getThumbnailUrl } from "@/utils/url";

type PostCardProps = {
  post: any;
  token?: string | null;
  onUpdate?: (updatedPost: any) => void;
  highlight?: string;
};

export default function PostCard({ post, token, onUpdate, highlight = "" }: PostCardProps) {
  const router = useRouter();
  const titleText = post.title || "";
  const rawPreview = (post.content || "").replace(/\s+/g, " ").trim();
  const preview =
    rawPreview.length > 0
      ? `${rawPreview.slice(0, 160)}${rawPreview.length > 160 ? "..." : ""}`
      : "暂无预览";
  const tagList = (post.tags || "")
    .split(/[,，]/)
    .map((tag: string) => tag.trim())
    .filter(Boolean);
  const normalizedQuery = highlight.trim().toLowerCase();
  const matchIndex = normalizedQuery
    ? titleText.toLowerCase().indexOf(normalizedQuery)
    : -1;
  const firstImageMatch = (post.content || "").match(/!\[.*?\]\((.*?)\)|<img.*?src=["'](.*?)["']/);
  const firstImageUrl = firstImageMatch ? (firstImageMatch[1] || firstImageMatch[2]) : null;
  // const thumbnailUrl = getThumbnailUrl(firstImageUrl, 400); // Unused currently in list view but logic existed
  const postAvatar = post.author_avatar || "";
  const avatarUrl = getThumbnailUrl(postAvatar, 64);

  return (
    <div className="card block no-underline text-inherit h-full flex flex-col">
      <Link href={`/post/${post.slug}`} className="block no-underline text-inherit flex-1">
        <div className="card-head flex justify-between items-start mb-3">
          <div className="author flex items-center gap-2">
            {postAvatar ? (
              <img
                src={avatarUrl}
                alt={post.author_name}
                loading="lazy"
                decoding="async"
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="avatar-fallback w-6 h-6 text-xs">{post.author_name?.[0] || "U"}</div>
            )}
            <span className="text-sm font-medium">{post.author_name || post.author || "匿名"}</span>
          </div>
          <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
        </div>

        <h2 className="text-xl font-bold mb-3 leading-tight">
          {matchIndex >= 0 ? (
            <>
              {titleText.slice(0, matchIndex)}
              <span className="highlight">
                {titleText.slice(matchIndex, matchIndex + normalizedQuery.length)}
              </span>
              {titleText.slice(matchIndex + normalizedQuery.length)}
            </>
          ) : (
            titleText
          )}
        </h2>

        <p className="excerpt text-muted text-sm mb-6 line-clamp-2 leading-relaxed">
          {preview}
        </p>
      </Link>

      <div className="post-card-footer flex justify-between items-center mt-auto pt-4 border-t border-white/5">
        <div className="tag-list">
          {tagList.map((tag: string) => (
            <span key={tag} className="tag-pill">#{tag}</span>
          ))}
        </div>

        <div className="post-card-actions flex gap-1">
          <button
            className="btn-ghost btn-sm"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!token) {
                router.push("/login");
                return;
              }
              fetch(`/api/blog/${post.slug}/like`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              })
                .then((res) => res.json())
                .then((data) => {
                  if (!data) return;
                  onUpdate?.({
                    ...post,
                    like_count: data.like_count ?? post.like_count,
                    dislike_count: data.dislike_count ?? post.dislike_count,
                    comment_count: data.comment_count ?? post.comment_count,
                    favorite_count: data.favorite_count ?? post.favorite_count,
                  });
                })
                .catch(() => { });
            }}
          >
            <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
          </button>
          <button
            className="btn-ghost btn-sm"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!token) {
                router.push("/login");
                return;
              }
              fetch(`/api/blog/${post.slug}/dislike`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              })
                .then((res) => res.json())
                .then((data) => {
                  if (!data) return;
                  onUpdate?.({
                    ...post,
                    like_count: data.like_count ?? post.like_count,
                    dislike_count: data.dislike_count ?? post.dislike_count,
                    comment_count: data.comment_count ?? post.comment_count,
                    favorite_count: data.favorite_count ?? post.favorite_count,
                  });
                })
                .catch(() => { });
            }}
          >
            <ThumbsDownIcon className="inline" /> {post.dislike_count ?? 0}
          </button>
          <button
            className={`btn-ghost btn-sm ${post.favorited_by_me ? "text-accent" : ""}`}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!token) {
                router.push("/login");
                return;
              }
              fetch(`/api/blog/${post.slug}/favorite`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              })
                .then((res) => res.json())
                .then((data) => {
                  if (!data) return;
                  onUpdate?.({
                    ...post,
                    like_count: data.like_count ?? post.like_count,
                    dislike_count: data.dislike_count ?? post.dislike_count,
                    comment_count: data.comment_count ?? post.comment_count,
                    favorite_count: data.favorite_count ?? post.favorite_count,
                    favorited_by_me: data.favorited ?? post.favorited_by_me,
                  });
                })
                .catch(() => { });
            }}
          >
            <BookmarkIcon filled={post.favorited_by_me} className="inline" /> {post.favorite_count ?? 0}
          </button>
          <button
            className="btn-ghost btn-sm"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              router.push(`/post/${post.slug}#comments`);
            }}
          >
            <MessageCircleIcon className="inline" /> {post.comment_count ?? 0}
          </button>
        </div>
      </div>
    </div>
  );
}
