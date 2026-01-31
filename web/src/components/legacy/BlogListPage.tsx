
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getThumbnailUrl } from "@/utils/url";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";
import UserHoverCard from "@/components/legacy/UserHoverCard";
import { getCachedJson, setCachedJson } from "@/utils/cache";
import {
  clearCommentsCache,
  clearListCache,
  clearPostCache,
  clearAllCaches,
  getListCache,
  setListCache as setListCacheMemory,
} from "@/utils/memoryStore";
import { resizeImageFile } from "@/utils/image";

export default function BlogListPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const normalizedQuery = submittedQuery.trim().toLowerCase();
  const [tagFilter, setTagFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const [imageSizePercent, setImageSizePercent] = useState(100);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [profileData, setProfileData] = useState<any>(null);
  const [tokenValue, setTokenValue] = useState<string | null>(null);
  const [userPostCount, setUserPostCount] = useState(0);
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState("loading");
  const isAdmin = profileData?.username === "witw";
  const [authorFilter, setAuthorFilter] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const etagRef = useRef("");
  const listCacheKeyRef = useRef("");
  const listFallbackCacheKeyRef = useRef("");
  const totalCountRef = useRef(0);
  const profileUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenValue(localStorage.getItem("token"));
      const storedProfile = localStorage.getItem("profile");
      const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
      setProfileData(parsedProfile);
      if (parsedProfile?.username) {
        setCachedJson(`cache:profile:${parsedProfile.username}`, parsedProfile);
      }
    } catch {
      setProfileData(null);
    }
  }, []);

  useEffect(() => {
    totalCountRef.current = totalCount;
  }, [totalCount]);


  function applyProfileUpdate(nextProfile: any) {
    if (nextProfile) {
      setProfileData(nextProfile);
      if (nextProfile?.username) {
        setCachedJson(`cache:profile:${nextProfile.username}`, nextProfile);
      }
      if (nextProfile?.username) {
        const nextName = nextProfile.nickname || nextProfile.username;
        setPosts((prev) =>
          prev.map((post) =>
            post.author === nextProfile.username
              ? { ...post, author_avatar: nextProfile.avatar_url || "", author_name: nextName }
              : post
          )
        );
      }
    }
    clearAllCaches();
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("cache:blog:") || key.startsWith("cache:post:") || key.startsWith("cache:comments:") || key.startsWith("cache:favorites:") || key.startsWith("cache:profile:")) {
          localStorage.removeItem(key);
        }
      });
    } catch { }
    loadPosts({ showLoading: false, force: true });
  }
  function normalizeListPayload(data: any) {
    if (Array.isArray(data)) {
      return { items: data, total: data.length };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total || 0,
    };
  }

  function buildListCacheKey(params: URLSearchParams, username: string) {
    return `cache:blog:${username}:${params.toString()}`;
  }

  function setListCache(value: any) {
    if (listCacheKeyRef.current) {
      setCachedJson(listCacheKeyRef.current, value);
      setListCacheMemory(listCacheKeyRef.current, value);
    }
    if (listFallbackCacheKeyRef.current && listFallbackCacheKeyRef.current !== listCacheKeyRef.current) {
      setCachedJson(listFallbackCacheKeyRef.current, value);
      setListCacheMemory(listFallbackCacheKeyRef.current, value);
    }
  }

  function applyPostUpdates(updater: (prev: any[]) => any[]) {
    setPosts((prev) => {
      const next = updater(prev);
      setListCache({
        items: next,
        total: totalCountRef.current,
      });
      return next;
    });
  }

  useEffect(() => {
    if (!profileData?.username) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserPostCount(0);
      return;
    }
    const params = new URLSearchParams({
      author: profileData.username,
      page: "1",
      size: "1",
    });
    const cacheKey = buildListCacheKey(params, profileData.username);
    const cached = getCachedJson(cacheKey);
    if (cached && typeof (cached as any).total === "number") {
      setUserPostCount((cached as any).total);
      return;
    }
    fetch(`/api/blog?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const normalized = normalizeListPayload(data);
        if (typeof normalized.total === "number") {
          setUserPostCount(normalized.total);
          setCachedJson(cacheKey, normalized);
        }
      })
      .catch(() => {
        setUserPostCount(0);
      });
  }, [profileData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSuggestions]);

  function loadPosts(options: { showLoading?: boolean; force?: boolean } = {}) {
    const { showLoading = false, force = false } = options;
    const params = new URLSearchParams({
      page: String(currentPage),
      size: String(pageSize),
    });
    if (submittedQuery.trim()) {
      params.set("q", submittedQuery.trim());
    }
    if (authorFilter) {
      params.set("author", authorFilter);
    }
    if (tagFilter.trim()) {
      params.set("tag", tagFilter.trim());
    }
    const username = profileData?.username || "anon";
    const cacheKey = buildListCacheKey(params, username);
    const fallbackKey = buildListCacheKey(params, "anon");
    listCacheKeyRef.current = cacheKey;
    listFallbackCacheKeyRef.current = fallbackKey;
    if (!force) {
      const cachedMemory =
        getListCache(cacheKey) || (cacheKey !== fallbackKey ? getListCache(fallbackKey) : null);
      const cached =
        cachedMemory ||
        getCachedJson(cacheKey) ||
        (cacheKey !== fallbackKey ? getCachedJson(fallbackKey) : null);
      if (cached) {
        const normalized = normalizeListPayload(cached);
        setPosts(normalized.items);
        setTotalCount(normalized.total);
        setStatus("ready");
        return;
      }
    }
    if (showLoading) {
      setStatus("loading");
    }
    const token = tokenValue;
    const headers: Record<string, string> = {
      ...(etagRef.current ? { "If-None-Match": etagRef.current } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(`/api/blog?${params.toString()}`, { headers })
      .then(async (res) => {
        if (res.status === 304) {
          setStatus("ready");
          return null;
        }
        const nextEtag = res.headers.get("ETag");
        if (nextEtag) {
          etagRef.current = nextEtag;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const normalized = normalizeListPayload(data);
        setPosts(normalized.items);
        setTotalCount(normalized.total);
        setListCache(normalized);
        setStatus("ready");
      })
      .catch(() => {
        if (showLoading) {
          setStatus("error");
        }
      });
  }

  useEffect(() => {
    loadPosts({ showLoading: true });
  }, [currentPage, submittedQuery, authorFilter, tagFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent;
      if (custom?.detail) {
        applyProfileUpdate(custom.detail);
      } else {
        try {
          const storedProfile = localStorage.getItem("profile");
          const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
          setProfileData(parsedProfile);
        } catch { }
      }
      applyProfileUpdate(null);
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [currentPage, submittedQuery, authorFilter, tagFilter, tokenValue, profileData]);

  useEffect(() => {
    loadPosts({ showLoading: false });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ts = localStorage.getItem("profile_updated_at");
    if (ts && profileUpdateRef.current !== ts) {
      profileUpdateRef.current = ts;
      try {
        const storedProfile = localStorage.getItem("profile");
        const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        applyProfileUpdate(parsedProfile);
      } catch {
        applyProfileUpdate(null);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [submittedQuery, authorFilter, tagFilter]);

  async function publish() {
    setPublishStatus("");
    if (!title.trim() || !content.trim()) {
      setPublishStatus("标题和内容不能为空。");
      return;
    }
    const token = tokenValue;
    if (!token) {
      router.push("/login");
      return;
    }
    const res = await fetch("/api/blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content, tags }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPublishStatus(data.detail || "发布失败。");
      return;
    }
    setPublishStatus("已发布。");
    setTitle("");
    setTags("");
    setContent("");
    if (listCacheKeyRef.current) {
      clearListCache(listCacheKeyRef.current);
    }
    if (listFallbackCacheKeyRef.current) {
      clearListCache(listFallbackCacheKeyRef.current);
    }
    loadPosts({ showLoading: false, force: true });
  }

  function handleImageSelect(file: File | undefined) {
    if (!file) return;
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingPreviewUrl(preview);
    setShowSizeModal(true);
  }

  async function uploadImage(file: File) {
    const token = tokenValue;
    if (!token) {
      router.push("/login");
      return null;
    }
    const resized = await resizeImageFile(file, 1600);
    const formData = new FormData();
    formData.append("file", resized);
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.url || null;
  }

  function insertImageMarkup(url: string, widthValue: string) {
    const markup = widthValue
      ? `<img src="${url}" style="max-width: 100%; width: ${widthValue};" />`
      : `![](${url})`;
    const textarea = contentRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}\n\n${markup}\n`);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    setContent((prev) => `${prev.slice(0, start)}${markup}${prev.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + markup.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const tagSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          posts
            .flatMap((post) => (post.tags || "").split(/[,，]/))
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ),
    [posts],
  );
  const titleSuggestions = useMemo(
    () => Array.from(new Set(posts.map((post) => post.title).filter(Boolean))),
    [posts],
  );
  const normalizedInput = searchInput.trim().toLowerCase();
  const filteredTags = normalizedInput
    ? tagSuggestions.filter((tag) => tag.toLowerCase().includes(normalizedInput))
    : [];
  const filteredTitles = normalizedInput
    ? titleSuggestions.filter((titleText) => titleText.toLowerCase().includes(normalizedInput))
    : [];
  return (
    <div className="blog-list-page">
      {/* Hero Section */}
      <section
        className="hero-section flex flex-col items-center justify-center text-center px-4 relative overflow-hidden"
        style={{
          minHeight: "calc(100vh - 64px)",
          background: "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.15), transparent 60%)"
        }}
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 pointer-events-none"></div>
        <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-xs font-medium text-blue-400 mb-8 backdrop-blur-md relative z-10">
          AI · 工程 · 创作
        </div>
        <h1 className="relative z-10 text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 text-white drop-shadow-sm leading-tight max-w-5xl">
          witw的技术与创作交流平台
        </h1>
        <p className="relative z-10 text-lg md:text-xl text-zinc-400 max-w-2xl mb-12 leading-relaxed">
          记录 AI 工程实践、系统构建与个人工具的演进
        </p>
        <div className="relative z-10 flex gap-4">
          <button
            className="bg-[#0070f3] text-white rounded-full px-8 py-3 text-base font-medium hover:bg-[#0060d9] transition-all hover:shadow-[0_0_20px_rgba(0,112,243,0.3)] hover:-translate-y-0.5"
            onClick={() => {
              document.getElementById("posts-anchor")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            开始阅读
          </button>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-medium border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm hover:-translate-y-0.5"
          >
            关于我
          </Link>
        </div>
      </section>

      {/* Main Content Anchor */}
      <div id="posts-anchor" className="scroll-mt-20"></div>

      <div className="container mx-auto max-w-4xl px-4 pt-16" style={{ minHeight: "calc(100vh - 60px)", paddingBottom: "64px" }}>

        {/* Main Feed */}
        <div>

          {status === "error" && <p className="text-red-400 mb-4">加载失败，请稍后再试。</p>}
          {status === "ready" && posts.length === 0 && <p className="text-zinc-500 mb-4">暂无文章，去发布第一篇吧。</p>}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
            <h3 className="text-3xl font-bold text-white tracking-tight">最新文章</h3>
            <div className="relative w-full md:w-auto md:min-w-[420px] max-w-lg">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none flex items-center justify-center z-10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                className="w-full bg-zinc-800 text-zinc-100 text-base rounded-full border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-zinc-500"
                style={{ paddingLeft: "3.5rem", paddingRight: "3rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
                ref={searchRef}
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSubmittedQuery(searchInput);
                    setTagFilter(""); // Clear tag filter when searching by text
                    setShowSuggestions(false);
                  }
                }}
                placeholder="搜索标题或标签..."
              />

              {/* Clear button if there is input */}
              {searchInput && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                  onClick={() => {
                    setSubmittedQuery("");
                    setTagFilter("");
                    setSearchInput("");
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}

              {showSuggestions && (filteredTags.length > 0 || filteredTitles.length > 0) && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden py-2" onMouseDown={(event) => event.preventDefault()}>
                  {filteredTags.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">标签</div>
                      {filteredTags.map((tag) => (
                        <button
                          key={`tag-${tag}`}
                          className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                          type="button"
                          onClick={() => {
                            setTagFilter(tag);
                            setSubmittedQuery(""); // Clear text query when selecting tag
                            setSearchInput(tag);
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="text-blue-500">#</span> {tag}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredTitles.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider mt-2">文章</div>
                      {filteredTitles.map((titleText) => (
                        <button
                          key={`title-${titleText}`}
                          className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors truncate"
                          type="button"
                          onClick={() => {
                            setSubmittedQuery(titleText);
                            setTagFilter("");
                            setSearchInput(titleText);
                            setShowSuggestions(false);
                          }}
                        >
                          {titleText}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="list grid mt-8 gap-6">
            {posts.map((post) => {
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
              const matchIndex = normalizedQuery
                ? titleText.toLowerCase().indexOf(normalizedQuery)
                : -1;
              const firstImageMatch = (post.content || "").match(/!\[.*?\]\((.*?)\)|<img.*?src=["'](.*?)["']/);
              const firstImageUrl = firstImageMatch ? (firstImageMatch[1] || firstImageMatch[2]) : null;
              const thumbnailUrl = getThumbnailUrl(firstImageUrl, 400);
              const effectiveAvatar = post.author === profileData?.username && profileData?.avatar_url
                ? profileData.avatar_url
                : post.author_avatar;
              const avatarUrl = getThumbnailUrl(effectiveAvatar || "", 64);

              return (
                <div key={post.slug} className="card block no-underline text-inherit">
                  <div className="card-head flex justify-between items-start mb-3">
                    <UserHoverCard username={post.author}>
                      <div className="author flex items-center gap-2">
                        {post.author_avatar ? (
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
                    </UserHoverCard>
                    <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
                  </div>
                  <Link href={`/post/${post.slug}`} className="block no-underline text-inherit">

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

                  <div className="post-card-footer flex justify-between items-center mt-auto">
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
                          const token = tokenValue;
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
                              applyPostUpdates((prev) =>
                                prev.map((item) =>
                                  item.slug === post.slug
                                    ? {
                                      ...item,
                                      like_count: data.like_count ?? item.like_count,
                                      dislike_count: data.dislike_count ?? item.dislike_count,
                                      comment_count: data.comment_count ?? item.comment_count,
                                      favorite_count: data.favorite_count ?? item.favorite_count,
                                    }
                                    : item,
                                ),
                              );
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
                          const token = tokenValue;
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
                              applyPostUpdates((prev) =>
                                prev.map((item) =>
                                  item.slug === post.slug
                                    ? {
                                      ...item,
                                      like_count: data.like_count ?? item.like_count,
                                      dislike_count: data.dislike_count ?? item.dislike_count,
                                      comment_count: data.comment_count ?? item.comment_count,
                                      favorite_count: data.favorite_count ?? item.favorite_count,
                                    }
                                    : item,
                                ),
                              );
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
                          const token = tokenValue;
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
                              applyPostUpdates((prev) =>
                                prev.map((item) =>
                                  item.slug === post.slug
                                    ? {
                                      ...item,
                                      like_count: data.like_count ?? item.like_count,
                                      dislike_count: data.dislike_count ?? item.dislike_count,
                                      comment_count: data.comment_count ?? item.comment_count,
                                      favorite_count: data.favorite_count ?? item.favorite_count,
                                      favorited_by_me: data.favorited ?? item.favorited_by_me,
                                    }
                                    : item,
                                ),
                              );
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
            })}
          </div>
          {totalPages > 1 && (
            <div className="pagination flex items-center justify-center gap-4 mt-8">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <span className="text-muted text-sm">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
