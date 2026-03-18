/**
 * BlogListPage - 文章列表页面组件
 *
 * 承担首页文章流的交互编排：同步 URL 分类筛选、驱动分页请求、衔接搜索栏，
 * 并把点赞、点踩、收藏与跳转评论等动作统一下发给列表项。
 */
"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { usePosts, usePostActions } from "../hooks";
import { HeroSection } from "./hero/HeroSection";
import { SearchBar } from "./search";
import { PostList } from "./post-list";
import { Pagination } from "./pagination/Pagination";
import { Loading } from "@/components/ui/Loading";

/**
 * 首页每页文章数。
 *
 * 固定为 6，便于在桌面端双列和三列布局之间保持整齐栅格。
 */
const PAGE_SIZE = 6;

/**
 * 渲染博客首页文章列表。
 *
 * 组件自身不直接处理远端请求细节，而是把数据获取和交互副作用下沉到 hooks，
 * 这里只保留页面级状态拼装与视图分支判断。
 *
 * @returns {JSX.Element} 博客列表页
 */
export default function BlogListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // `page` 和 `submittedQuery` 共同决定实际请求；`searchQuery` 只用于输入框草稿态。
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const selectedCategory = searchParams.get("category") || "";
  const hasCategoryFilter = Boolean(selectedCategory);

  const { posts, status, error, updatePost, totalPages } = usePosts({
    page,
    pageSize: PAGE_SIZE,
    query: submittedQuery,
    category: selectedCategory,
  });

  const handleAuthRequired = useCallback(() => {
    router.push("/login");
  }, [router]);

  const { like, dislike, favorite } = usePostActions({
    isAuthenticated,
    onUpdate: updatePost,
    onAuthRequired: handleAuthRequired,
  });

  const handleSearch = useCallback((value: string) => {
    // 新搜索词提交后总是回到第一页，避免沿用旧页码导致空结果。
    setSubmittedQuery(value);
    setPage(1);
  }, []);

  const handleCommentClick = useCallback((slug: string) => {
    router.push(`/post/${slug}#comments`);
  }, [router]);

  const isLoading = status === "loading";
  const hasError = status === "error";

  return (
    <div className="blog-list-page">
      {!hasCategoryFilter && (
        <HeroSection
          primaryAction={{ label: "开始阅读", href: "#posts-anchor" }}
          secondaryAction={{ label: "关于我", href: "/about" }}
        />
      )}

      <div id="posts-anchor" className="scroll-mt-20" />

      <div className="blog-list-container container mx-auto w-full pt-16">
        {/* 加载和错误状态在页面层统一兜底，避免子组件分散处理空态逻辑。 */}
        {isLoading && (
          <div className="py-16">
            <Loading size="lg" />
          </div>
        )}

        {hasError && (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error || "加载失败，请稍后重试。"}</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              重试
            </button>
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="w-full">
            <section className="home-feed-shell min-w-0">
              <div className="home-feed">
                <header className="home-feed-head">
                  <div>
                    <div className="home-feed-kicker">LATEST TRANSMISSIONS</div>
                    <h3 className="home-feed-title">最新文章</h3>
                  </div>

                  {submittedQuery && (
                    <div className="home-feed-filters">
                      <span className="home-feed-filter">搜索: {submittedQuery}</span>
                    </div>
                  )}
                </header>

                <div className="home-search-shell">
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSearch={handleSearch}
                    posts={posts}
                  />
                </div>

                <PostList
                  posts={posts}
                  highlightQuery={submittedQuery}
                  currentUser={user}
                  onLike={like}
                  onDislike={dislike}
                  onFavorite={favorite}
                  onCommentClick={handleCommentClick}
                />

                <div className="home-feed-foot">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
