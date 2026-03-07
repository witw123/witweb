"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsUpIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";
import { getVersionedApiPath } from "@/lib/api-version";
import { post as postRequest } from "@/lib/api-client";
import { useAuth } from "@/app/providers";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";
import type { PostListItem } from "@/types/blog";

type PostCardProps = {
  post: PostListItem;
  onUpdate?: (updatedPost: PostListItem) => void;
  highlight?: string;
};

type PostMetricsData = {
  like_count?: number;
  dislike_count?: number;
  comment_count?: number;
  favorite_count?: number;
  favorited?: boolean;
};

export default function PostCard({ post, onUpdate, highlight = "" }: PostCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const titleText = post.title || "";

  // Use excerpt if available, otherwise use content preview
  const rawPreview = post.excerpt || (post.content || "").replace(/\s+/g, " ").trim();
  const preview =
    rawPreview.length > 0
      ? `${rawPreview.slice(0, 120)}${rawPreview.length > 120 ? "..." : ""}`
      : "暂无预览";

  const tagList = (post.tags || "")
    .split(/[,，]/)
    .map((tag: string) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);

  const normalizedQuery = highlight.trim().toLowerCase();
  const matchIndex = normalizedQuery
    ? titleText.toLowerCase().indexOf(normalizedQuery)
    : -1;

  const postAvatar = post.author_avatar || "";
  const avatarUrl = getThumbnailUrl(postAvatar, 64);
  const avatarUnoptimized = shouldBypassImageOptimization(avatarUrl);

  // Cover image handling
  const coverUrl = post.cover_image_url;
  const coverUnoptimized = coverUrl ? shouldBypassImageOptimization(coverUrl) : false;

  // Format date
  const postDate = new Date(post.created_at);
  const dateStr = postDate.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });

  async function handleAction(
    action: "like" | "dislike" | "favorite",
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    try {
      const data = await postRequest<PostMetricsData>(
        getVersionedApiPath(`/blog/${post.slug}/${action}`)
      );
      onUpdate?.({
        ...post,
        like_count: data.like_count ?? post.like_count,
        dislike_count: data.dislike_count ?? post.dislike_count,
        comment_count: data.comment_count ?? post.comment_count,
        favorite_count: data.favorite_count ?? post.favorite_count,
        favorited_by_me: data.favorited ?? post.favorited_by_me,
      });
    } catch {
      // Keep the card interaction non-blocking.
    }
  }

  return (
    <article className="group card post-card-hover h-full flex flex-col overflow-hidden transition-all duration-200 hover:border-white/15 hover:bg-zinc-900/30 cursor-pointer">
      {/* Cover image */}
      {coverUrl ? (
        <Link href={`/post/${post.slug}`} className="block relative aspect-[2.2/1] overflow-hidden -mt-4 -mx-4 mb-4">
          <Image
            src={coverUrl}
            alt={titleText}
            fill
            sizes="(max-width: 768px) 100vw, 500px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized={coverUnoptimized}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </Link>
      ) : null}

      {/* Content */}
      <div className="flex flex-1 flex-col">
        {/* Author & Date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {postAvatar ? (
              <Image
                src={avatarUrl}
                alt={post.author_name}
                width={28}
                height={28}
                loading="lazy"
                className="w-7 h-7 rounded-full ring-2 ring-white/10"
                unoptimized={avatarUnoptimized}
              />
            ) : (
              <div className="avatar-fallback w-7 h-7 text-xs ring-2 ring-white/10">
                {post.author_name?.[0] || "U"}
              </div>
            )}
            <span className="text-sm font-medium text-zinc-300">{post.author_name || post.author || "未知作者"}</span>
          </div>
          <time className="text-xs text-zinc-500" dateTime={post.created_at}>
            {dateStr}
          </time>
        </div>

        {/* Title */}
        <Link href={`/post/${post.slug}`} className="block flex-1 no-underline text-inherit">
          <h2 className="text-lg font-bold mb-2 leading-snug text-zinc-100 group-hover:text-blue-400 transition-colors line-clamp-2">
            {matchIndex >= 0 ? (
              <>
                {titleText.slice(0, matchIndex)}
                <span className="highlight bg-yellow-500/30 text-yellow-200">
                  {titleText.slice(matchIndex, matchIndex + normalizedQuery.length)}
                </span>
                {titleText.slice(matchIndex + normalizedQuery.length)}
              </>
            ) : (
              titleText
            )}
          </h2>

          {/* Excerpt */}
          <p className="text-sm text-zinc-400 mb-3 line-clamp-2 leading-relaxed">
            {preview}
          </p>
        </Link>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {tagList.map((tag: string) => (
              <span key={tag} className="tag-pill text-xs">#{tag}</span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            <button
              className="btn-ghost btn-sm px-2 text-zinc-500 hover:text-blue-400"
              type="button"
              onClick={(event) => void handleAction("like", event)}
            >
              <ThumbsUpIcon className="inline w-4 h-4" />
              <span className="ml-1 text-xs">{post.like_count ?? 0}</span>
            </button>
            <button
              className="btn-ghost btn-sm px-2 text-zinc-500 hover:text-blue-400"
              type="button"
              onClick={(event) => void handleAction("favorite", event)}
            >
              <BookmarkIcon
                filled={post.favorited_by_me}
                className={`inline w-4 h-4 ${post.favorited_by_me ? "text-blue-400" : ""}`}
              />
              <span className="ml-1 text-xs">{post.favorite_count ?? 0}</span>
            </button>
            <button
              className="btn-ghost btn-sm px-2 text-zinc-500 hover:text-blue-400"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                router.push(`/post/${post.slug}#comments`);
              }}
            >
              <MessageCircleIcon className="inline w-4 h-4" />
              <span className="ml-1 text-xs">{post.comment_count ?? 0}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
