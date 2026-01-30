
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getThumbnailUrl } from "@/utils/url";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";
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
    } catch {}
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
        } catch {}
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
        applyProfileUpdate(parsedProfile);
      } catch {
        applyProfileUpdate(null);
      }
    }
  }, []);

  useEffect(() => {
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
    <div className="blog-list-page" style={{ minHeight: "calc(100vh - 60px)", paddingTop: "2rem", paddingBottom: "64px" }}>
      <div className="split-layout">
        <aside className="side-panel">
          <div className="card">
            <h3 className="text-lg font-bold mb-4">发布新文章</h3>
            {!tokenValue ? (
              <>
                <p className="text-muted mb-4 text-sm">登录后可在此发布文章。</p>
                <Link className="btn-primary w-full" href="/login">
                  去登录
                </Link>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">标题</label>
                  <input
                    className="input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="文章标题"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">标签</label>
                  <input
                    className="input"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="例如：动画, 角色, 经验"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium block">内容</label>
                    <label className="btn-ghost btn-sm cursor-pointer">
                      上传图片
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          handleImageSelect(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <textarea
                    className="input"
                    rows={12}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    ref={contentRef}
                    placeholder="使用 Markdown 写作..."
                  />
                </div>

                {showSizeModal && pendingImageFile && (
                  <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    style={{ background: "rgba(0,0,0,0.8)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <div className="card" style={{ width: "400px", maxWidth: "90%" }}>
                      <h3 className="text-lg font-bold mb-4">调整图片大小</h3>
                      <div className="mb-4 bg-black/20 p-2 rounded flex justify-center">
                        <img
                          src={pendingPreviewUrl}
                          alt="preview"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "300px",
                            width: imageWidth.trim() ? imageWidth.trim() : `${imageSizePercent}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <input
                          type="range"
                          min="10"
                          max="100"
                          className="flex-1"
                          value={imageSizePercent}
                          onChange={(event) => setImageSizePercent(Number(event.target.value))}
                        />
                        <span className="text-sm w-12 text-right">{imageSizePercent}%</span>
                      </div>
                      <input
                        className="input mb-4"
                        value={imageWidth}
                        onChange={(event) => setImageWidth(event.target.value)}
                        placeholder="或输入宽度，例如 360px / 60%"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          className="btn-ghost"
                          type="button"
                          onClick={() => {
                            if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
                            setPendingPreviewUrl("");
                            setPendingImageFile(null);
                            setShowSizeModal(false);
                          }}
                        >
                          取消
                        </button>
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={async () => {
                            const widthValue = imageWidth.trim() ? imageWidth.trim() : `${imageSizePercent}%`;
                            if (!pendingImageFile) return;
                            const url = await uploadImage(pendingImageFile);
                            if (url) {
                              insertImageMarkup(url, widthValue);
                            }
                            if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
                            setPendingPreviewUrl("");
                            setPendingImageFile(null);
                            setShowSizeModal(false);
                          }}
                        >
                          插入图片
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {publishStatus && <p className="text-accent text-sm">{publishStatus}</p>}
                <button className="btn-primary w-full" type="button" onClick={publish}>
                  发布
                </button>
              </div>
            )}
          </div>
        </aside>

        <section>
          {status === "error" && <p>加载失败，请稍后再试。</p>}
          {status === "ready" && posts.length === 0 && <p>暂无文章，去左侧发布第一篇吧。</p>}

          <div className="section-header flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">最新文章</h3>
            <div className="search flex gap-2 items-center relative" style={{ width: "60%" }}>
              <input
                className="input"
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
                    setTagFilter(searchInput);
                    setShowSuggestions(false);
                  }
                }}
                placeholder="搜索标题或标签..."
              />
              {showSuggestions && (filteredTags.length > 0 || filteredTitles.length > 0) && (
                <div className="search-suggestions" onMouseDown={(event) => event.preventDefault()}>
                  {filteredTags.length > 0 && (
                    <>
                      <div className="suggestion-group">标签</div>
                      {filteredTags.map((tag) => (
                        <button
                          key={`tag-${tag}`}
                          className="suggestion-item"
                          type="button"
                          onClick={() => {
                            setTagFilter(tag);
                            setSubmittedQuery("");
                            setSearchInput(tag);
                            setShowSuggestions(false);
                          }}
                        >
                          #{tag}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredTitles.length > 0 && (
                    <>
                      <div className="suggestion-group">文章</div>
                      {filteredTitles.map((titleText) => (
                        <button
                          key={`title-${titleText}`}
                          className="suggestion-item"
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
              {submittedQuery && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    setSubmittedQuery("");
                    setSearchInput("");
                  }}
                >
                  清空
                </button>
              )}
              {authorFilter && (
                <button className="button ghost" type="button" onClick={() => setAuthorFilter("")}
                >
                  仅看我的文章
                </button>
              )}
              {tagFilter && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    setTagFilter("");
                    setSearchInput("");
                  }}
                >
                  清除标签
                </button>
              )}
            </div>
          </div>
          <div className="list grid">
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
                  <Link href={`/post/${post.slug}`} className="block no-underline text-inherit">
                  <div className="card-head flex justify-between items-start mb-3">
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
                    <span className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</span>
                  </div>

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
                            .catch(() => {});
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
                            .catch(() => {});
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
                            .catch(() => {});
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
        </section>
      </div>
    </div>
  );
}
