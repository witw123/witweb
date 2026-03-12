/**
 * FavoritesPage - 我的收藏页面组件
 *
 * 展示当前用户收藏的文章列表，支持：
 * - 分页浏览
 * - 点赞、点踩、收藏操作
 * - 跳转到评论
 *
 * @component
 * @example
 * <FavoritesPage />
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { getPaginated } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { PostCard } from "@/features/blog/components/post-list/PostCard";
import { Pagination } from "@/features/blog/components/pagination/Pagination";
import { usePostActions } from "@/features/blog/hooks";
import type { PostListItem } from "@/types/blog";
import { queryKeys } from "@/lib/query-keys";

export default function FavoritesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const favoritesQuery = useQuery({
    queryKey: queryKeys.favorites(page, pageSize),
    queryFn: async () => {
      const data = await getPaginated<PostListItem>(
        getVersionedApiPath("/favorites"),
        { page, size: pageSize }
      );
      return {
        items: Array.isArray(data.items) ? data.items : [],
        total: data.total || 0,
      };
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const items = favoritesQuery.data?.items || [];
  const total = favoritesQuery.data?.total || 0;
  const status =
    favoritesQuery.status === "pending"
      ? "loading"
      : favoritesQuery.status === "error"
        ? "error"
        : "ready";

  const updatePost = useCallback(
    (slug: string, updates: Partial<PostListItem>) => {
      queryClient.setQueryData<{ items: PostListItem[]; total: number }>(
        queryKeys.favorites(page, pageSize),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.slug === slug ? { ...item, ...updates } : item
                ),
              }
            : current
      );
    },
    [page, pageSize, queryClient]
  );

  const { like, dislike, favorite } = usePostActions({
    isAuthenticated,
    onUpdate: updatePost,
    onAuthRequired: () => router.push("/login"),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.favorites(page, pageSize),
      });
    };

    window.addEventListener("profile-updated", handler as EventListener);
    window.addEventListener("blog-updated", handler as EventListener);

    return () => {
      window.removeEventListener("profile-updated", handler as EventListener);
      window.removeEventListener("blog-updated", handler as EventListener);
    };
  }, [page, pageSize, queryClient]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container blog-page-shell">
      <div className="blog-page-header">
        <div>
          <h1 className="blog-page-title">我的收藏</h1>
          <p className="blog-page-subtitle">你收藏的文章都在这里。</p>
        </div>
        <div className="actions">
          <Link className="btn-ghost" href="/">
            返回首页
          </Link>
        </div>
      </div>

      {status === "error" && <p>加载失败，请稍后重试。</p>}
      {status === "ready" && items.length === 0 && <p>暂无收藏。</p>}

      <div className="list grid gap-4">
        {items.map((post) => (
          <PostCard
            key={post.slug}
            post={post}
            currentUser={
              user ? { username: user.username, avatar_url: user.avatar_url } : null
            }
            onLike={like}
            onDislike={dislike}
            onFavorite={favorite}
            onCommentClick={(slug) => router.push(`/post/${slug}#comments`)}
          />
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
