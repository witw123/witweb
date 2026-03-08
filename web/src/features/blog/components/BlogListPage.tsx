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

// Adjust PAGE_SIZE to 6 so it's divisible by 2 and 3 for the grid layout
const PAGE_SIZE = 6;

export default function BlogListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // 筛选状态
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const selectedCategory = searchParams.get("category") || "";
  const hasCategoryFilter = Boolean(selectedCategory);

  // 数据获取
  const { posts, status, error, updatePost, totalPages } = usePosts({
    page,
    pageSize: PAGE_SIZE,
    query: submittedQuery,
    category: selectedCategory,
  });

  // 行为处理
  const handleAuthRequired = useCallback(() => {
    router.push("/login");
  }, [router]);

  const { like, dislike, favorite } = usePostActions({
    isAuthenticated,
    onUpdate: updatePost,
    onAuthRequired: handleAuthRequired,
  });

  const handleSearch = useCallback((value: string) => {
    setSubmittedQuery(value);
    setPage(1);
  }, []);

  const handleCommentClick = useCallback((slug: string) => {
    router.push(`/post/${slug}#comments`);
  }, [router]);

  const scrollToPosts = useCallback(() => {
    document.getElementById("posts-anchor")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isLoading = status === "loading";
  const hasError = status === "error";

  return (
    <div className="blog-list-page">
      {!hasCategoryFilter && (
        <HeroSection
          primaryAction={{ label: "开始阅读", onClick: scrollToPosts }}
          secondaryAction={{ label: "关于我", href: "/about" }}
        />
      )}

      <div id="posts-anchor" className="scroll-mt-20" />

      <div className="blog-list-container container mx-auto w-full pt-16">
        {/* 状态展示 */}
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

        {/* 文章列表 */}
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
