"use client";

import Image from "next/image";
import Link from "next/link";
import { BookmarkIcon, MessageCircleIcon, ThumbsDownIcon, ThumbsUpIcon } from "@/components/Icons";
import UserHoverCard from "@/features/blog/components/UserHoverCard";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";
import type { PostDetail } from "@/types";

type TocItem = {
  id: string;
  text: string;
  level: number;
};

type BlogPostContentProps = {
  post: PostDetail | null;
  status: "loading" | "error" | "ready";
  canEdit: boolean;
  isEditing: boolean;
  tagList: string[];
  readingStats: {
    length: number;
    minutes: number;
  };
  tocItems: TocItem[];
  markdownHtml: string;
  commentsCount: number;
  onToggleEdit: () => void;
  onLike: () => void;
  onDislike: () => void;
  onFavorite: () => void;
};

export function BlogPostContent({
  post,
  status,
  canEdit,
  isEditing,
  tagList,
  readingStats,
  tocItems,
  markdownHtml,
  commentsCount,
  onToggleEdit,
  onLike,
  onDislike,
  onFavorite,
}: BlogPostContentProps) {
  const coverUrl = post?.cover_image_url;
  const coverUnoptimized = coverUrl ? shouldBypassImageOptimization(coverUrl) : false;

  return (
    <>
      {/* Cover Image */}
      {coverUrl && (
        <div className="post-cover-wrapper -mx-4 -mt-5 mb-6 lg:-mx-6">
          <div className="relative aspect-[21/9] lg:aspect-[2.4/1] overflow-hidden rounded-xl">
            <Image
              src={coverUrl}
              alt={post?.title || ""}
              fill
              sizes="(max-width: 768px) 100vw, 1120px"
              className="object-cover"
              priority
              unoptimized={coverUnoptimized}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        </div>
      )}

      <div className="post-toolbar mb-4 flex items-center justify-between">
        <div>
          {canEdit && (
            <button className="btn-ghost" type="button" onClick={onToggleEdit}>
              {isEditing ? "取消编辑" : "编辑"}
            </button>
          )}
        </div>
        <Link className="btn-ghost" href="/">
          返回主页
        </Link>
      </div>

      {post?.title && <h1 className="post-title mb-4 text-3xl font-bold lg:text-4xl">{post.title}</h1>}

      {post && (
        <div className="post-hero mb-6 flex flex-col gap-4 border-b border-subtle pb-6">
          <div className="post-hero-main flex items-center justify-between">
            <div className="post-author-block flex items-center gap-3">
              <UserHoverCard username={post.author}>
                {post.author_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getThumbnailUrl(post.author_avatar, 96)}
                    alt={post.author_name}
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="avatar-fallback flex h-10 w-10 items-center justify-center rounded-full text-sm">
                    {post.author_name?.[0] || "U"}
                  </div>
                )}
              </UserHoverCard>
              <div className="flex flex-col">
                <UserHoverCard username={post.author} disableHover={true}>
                  <span className="post-author-name cursor-pointer text-lg font-bold">
                    {post.author_name || post.author}
                  </span>
                </UserHoverCard>
                <div className="post-author-meta flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{new Date(post.created_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{readingStats.minutes} 分钟阅读</span>
                </div>
              </div>
            </div>

            <div className="post-hero-actions flex items-center gap-2">
              <button className="btn-ghost btn-sm" type="button" onClick={onLike}>
                <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
              </button>
              <button className="btn-ghost btn-sm" type="button" onClick={onDislike}>
                <ThumbsDownIcon className="inline" /> {post.dislike_count ?? 0}
              </button>
              <button
                className={`btn-ghost btn-sm ${post.favorited_by_me ? "text-accent" : ""}`}
                type="button"
                onClick={onFavorite}
              >
                <BookmarkIcon filled={post.favorited_by_me} className="inline" />{" "}
                {post.favorite_count ?? 0}
              </button>
              <span className="btn-ghost btn-sm cursor-default">
                <MessageCircleIcon className="inline" /> {commentsCount}
              </span>
            </div>
          </div>
        </div>
      )}



      {status === "error" && <p>加载失败，请稍后再试。</p>}

      {status === "ready" && post && !isEditing && (
        <>
          <div className="post-layout">
            {tocItems.length > 0 && (
              <aside className="toc">
                <div className="toc-title">目录</div>
                <ul>
                  {tocItems.map((item) => (
                    <li key={item.id} className={`toc-item level-${item.level}`}>
                      <a href={`#${item.id}`}>{item.text}</a>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
            <article className="min-w-0">
              {post && (
                <div className="post-meta-stack mb-8 flex flex-wrap items-center gap-3">
                  <div className="category-row">
                    <span className="category-chip">{post.category_name || "未分类"}</span>
                  </div>
                  {tagList.length > 0 && (
                    <div className="tag-list flex flex-wrap gap-2">
                      {tagList.map((tag) => (
                        <span key={tag} className="tag-pill">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div
                className="markdown"
                dangerouslySetInnerHTML={{ __html: markdownHtml }}
              />
            </article>
          </div>
          {post.created_at && (
            <div className="post-footer text-sm text-muted mt-8 pt-4 border-t border-zinc-800">
              发布于 {new Date(post.created_at).toLocaleString("zh-CN")}
              {post.updated_at && post.updated_at !== post.created_at && (
                <span className="ml-2">· 更新于 {new Date(post.updated_at).toLocaleString("zh-CN")}</span>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
