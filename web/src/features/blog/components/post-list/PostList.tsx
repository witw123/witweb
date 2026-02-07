"use client";

import type { PostListItem } from "@/types/blog";
import { PostCard } from "./PostCard";

interface PostListProps {
  posts: PostListItem[];
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
    <div className="list mt-5 grid gap-4">
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
