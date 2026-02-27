"use client";

import { useState, useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { usePosts, usePostActions } from "../hooks";
import { HeroSection } from "./hero/HeroSection";
import { SearchBar } from "./search";
import { PostList } from "./post-list";
import { Pagination } from "./pagination/Pagination";
import { Loading } from "@/components/ui/Loading";

const PAGE_SIZE = 5;

export default function BlogListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();

  // 筛选状态
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([]);
  const selectedCategory = searchParams.get("category") || "";
  const hasCategoryFilter = Boolean(selectedCategory);

  // 获取所有标签
  useEffect(() => {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.tags) {
          setAllTags(data.data.tags.slice(0, 12));
        }
      })
      .catch((err) => console.error("Failed to fetch tags:", err));
  }, []);

  // 数据获取
  const { posts, status, error, updatePost, totalPages } = usePosts({
    page,
    pageSize: PAGE_SIZE,
    query: submittedQuery,
    tag: selectedTag,
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

  const tags = useMemo(() => {
    return allTags.map((item) => [item.tag, item.count] as [string, number]);
  }, [allTags]);

  const maxTagCount = useMemo(() => {
    return Math.max(1, ...tags.map(([, count]) => count));
  }, [tags]);

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
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[clamp(240px,24vw,380px)_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="tag-atlas-shell">
                <div className="tag-atlas">
                  <div className="tag-atlas-head">
                    <div>
                      <div className="tag-atlas-kicker">WITWEB ATLAS</div>
                      <h4 className="tag-atlas-title">标签</h4>
                      <div className="tag-atlas-sub">按主题筛选本页</div>
                    </div>

                    {selectedTag ? (
                      <button
                        type="button"
                        className="tag-atlas-reset"
                        onClick={() => {
                          setSelectedTag("");
                          setPage(1);
                        }}
                        title="清除标签筛选"
                      >
                        清除
                      </button>
                    ) : null}
                  </div>

                  {selectedTag && (
                    <div className="tag-atlas-focus">
                      <span className="tag-atlas-focus-dot" />
                      <span className="tag-atlas-focus-text">
                        Focus: <span className="tag-atlas-focus-tag">#{selectedTag}</span>
                      </span>
                    </div>
                  )}

                  {tags.length === 0 ? (
                    <p className="tag-atlas-empty">当前结果暂无标签</p>
                  ) : (
                    <div className="tag-atlas-cloud" role="list">
                      {tags.map(([tag, count]) => {
                        const active = selectedTag === tag;
                        const strength = Math.min(1, Math.max(0.15, count / maxTagCount));
                        const chipStyle = { "--tag-strength": strength } as CSSProperties & Record<"--tag-strength", number>;
                        return (
                          <button
                            key={tag}
                            type="button"
                            role="listitem"
                            className={`tag-atlas-chip ${active ? "is-active" : ""}`}
                            style={chipStyle}
                            onClick={() => {
                              setSelectedTag(active ? "" : tag);
                              setPage(1);
                            }}
                          >
                            <span className="tag-atlas-chip-hash">#</span>
                            <span className="tag-atlas-chip-text">{tag}</span>
                            <span className="tag-atlas-chip-count">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="tag-atlas-foot">
                    <div className="tag-atlas-foot-line" />
                    <div className="tag-atlas-foot-text">精选你的内容</div>
                  </div>
                </div>
              </div>
            </aside>

            <section className="home-feed-shell min-w-0">
              <div className="home-feed">
                <header className="home-feed-head">
                  <div>
                    <div className="home-feed-kicker">LATEST TRANSMISSIONS</div>
                    <h3 className="home-feed-title">最新文章</h3>
                  </div>

                  {(submittedQuery || selectedTag) && (
                    <div className="home-feed-filters">
                      {submittedQuery && <span className="home-feed-filter">搜索: {submittedQuery}</span>}
                      {selectedTag && <span className="home-feed-filter">标签: #{selectedTag}</span>}
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
