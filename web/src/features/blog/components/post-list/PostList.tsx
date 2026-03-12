/**
 * PostList - 文章列表容器组件
 *
 * 接收文章列表数据，渲染 PostCard 组件列表
 * 无文章时显示空状态提示
 *
 * @component
 * @example
 * <PostList
 *   posts={posts}
 *   highlightQuery="关键词"
 *   currentUser={user}
 *   onLike={handleLike}
 *   onDislike={handleDislike}
 *   onFavorite={handleFavorite}
 *   onCommentClick={handleComment}
 * />
 */
"use client";

import type { PostListItem } from "@/types/blog";
import { PostCard } from "./PostCard";

/**
 * PostList 组件属性
 */
interface PostListProps {
  /** 文章列表数据 */
  posts: PostListItem[];
  /** 高亮搜索关键词 */
  highlightQuery?: string;
  /** 当前登录用户信息 */
  currentUser?: {
    username: string;
    avatar_url?: string;
  } | null;
  /** 点赞回调 */
  onLike: (post: PostListItem) => void;
  /** 点踩回调 */
  onDislike: (post: PostListItem) => void;
  /** 收藏回调 */
  onFavorite: (post: PostListItem) => void;
  /** 点击评论回调 */
  onCommentClick: (slug: string) => void;
}

/**
 * PostList - 文章列表容器组件
 *
 * 接收文章列表数据，渲染 PostCard 组件列表
 * 无文章时显示空状态提示
 *
 * @component
 * @example
 * <PostList
 *   posts={posts}
 *   highlightQuery="关键词"
 *   currentUser={user}
 *   onLike={handleLike}
 *   onDislike={handleDislike}
 *   onFavorite={handleFavorite}
 *   onCommentClick={handleComment}
 * />
 */
export function PostList({
  posts,
  highlightQuery,
  currentUser,
  onLike,
  onDislike,
  onFavorite,
  onCommentClick,
}: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-500">暂无文章</p>
      </div>
    );
  }

  return (
    <div className="post-card-grid mt-5">
      {posts.map((post) => (
        <PostCard
          key={post.slug}
          post={post}
          highlightQuery={highlightQuery}
          currentUser={currentUser}
          onLike={onLike}
          onDislike={onDislike}
          onFavorite={onFavorite}
          onCommentClick={onCommentClick}
        />
      ))}
    </div>
  );
}
