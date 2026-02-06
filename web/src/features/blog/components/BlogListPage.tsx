"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { usePosts, usePostActions } from "../hooks";
import { HeroSection } from "./hero/HeroSection";
import { SearchBar } from "./search";
import { PostList } from "./post-list";
import { Pagination } from "./pagination/Pagination";
import { Loading } from "@/components/ui/Loading";

const PAGE_SIZE = 10;

export default function BlogListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();

  // 筛选状态
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const hasCategoryFilter = Boolean(selectedCategory);

  useEffect(() => {
    const categoryFromUrl = searchParams.get("category") || "";
    setSelectedCategory(categoryFromUrl);
    setPage(1);
  }, [searchParams]);

  // 数据获取
  const { posts, status, error, updatePost, totalPages } = usePosts({
    page,
    pageSize: PAGE_SIZE,
    query: submittedQuery,
    category: selectedCategory,
    token,
  });

  // 行为处理
  const handleAuthRequired = useCallback(() => {
    router.push("/login");
  }, [router]);

  const { like, dislike, favorite } = usePostActions({
    token,
    onUpdate: updatePost,
    onAuthRequired: handleAuthRequired,
  });

  const handleSearch = useCallback((value: string) => {
    setSubmittedQuery(value);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback(
    (value: string) => {
      setSelectedCategory(value);
      setPage(1);

      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("category", value);
      } else {
        params.delete("category");
      }
      const query = params.toString();
      router.replace(query ? `/?${query}` : "/");
    },
    [router, searchParams]
  );

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
          secondaryAction={{ label: "关于我", href: "/profile" }}
        />
      )}

      <div id="posts-anchor" className="scroll-mt-20" />

      <div className="container mx-auto max-w-4xl px-4 pt-16" style={{ minHeight: "calc(100vh - 60px)", paddingBottom: "64px" }}>
        {/* 筛选栏 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <h3 className="text-3xl font-bold text-white tracking-tight">最新文章</h3>
          
          <div className="w-full md:flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              posts={posts}
            />
          </div>

        </div>

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
          <>
            <PostList
              posts={posts}
              highlightQuery={submittedQuery}
              currentUser={user}
              onLike={like}
              onDislike={dislike}
              onFavorite={favorite}
              onCommentClick={handleCommentClick}
            />

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
