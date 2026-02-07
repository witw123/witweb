
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getThumbnailUrl } from "@/utils/url";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";
import UserHoverCard from "@/features/blog/components/UserHoverCard";
import { marked } from "marked";
import createDOMPurify from "dompurify";
import { useAuth } from "@/app/providers";
import {
  clearAllListCache,
  clearPostCache,
  getCommentsCache,
  getPostCache,
  setCommentsCache,
  setPostCache,
  clearAllCaches,
} from "@/utils/memoryStore";
import { resizeImageFile } from "@/utils/image";
import { getCachedJson, setCachedJson } from "@/utils/cache";
import { emitPostMetricsUpdated, POST_METRICS_UPDATED_EVENT, type PostMetricsUpdateDetail } from "../utils/postMetricsSync";
import { hasMarkdownSyntax, renderPlainTextHtml } from "../utils/contentFormat";

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [status, setStatus] = useState("loading");
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentListStatus, setCommentListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [commentPage, setCommentPage] = useState(1);
  const commentsPerPage = 5;
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [imageWidth, setImageWidth] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageSizePercent, setImageSizePercent] = useState(100);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const editPreviewRef = useRef<HTMLDivElement | null>(null);
  const imageReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const refreshCommentsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const purifier = useMemo(
    () => (typeof window !== "undefined" ? createDOMPurify(window) : null),
    []
  );

  const { user: profile, token, isAuthenticated } = useAuth();

  const canEdit = profile?.username && post?.author && profile.username === post.author;
  const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";
  const isAdmin = !!profile?.username && (profile?.role === "admin" || profile.username === adminUsername);

  const cacheUserKeys = [profile?.username || "anon"];
  const cacheKeySignature = `${cacheUserKeys.join("|")}:${slug}`;
  const localPostKeys = cacheUserKeys.map((key) => `cache:post:${key}:${slug}`);
  const localCommentKeys = cacheUserKeys.map((key) => `cache:comments:${key}:${slug}`);

  function slugify(text: string) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const sanitizeHtml = useCallback((html: string) => {
    if (!purifier) return html;
    return purifier.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["style", "id"],
    });
  }, [purifier]);

  function loadPost(options: { force?: boolean } = {}) {
    const { force = false } = options;
    if (!slug) return;
    let hasCached = false;
    if (!force) {
      for (const key of cacheUserKeys) {
        const cached = getPostCache(`${key}:${slug}`);
        if (cached) {
          setPost(cached);
          setStatus("ready");
          hasCached = true;
          break;
        }
      }
      if (!hasCached) {
        for (const key of localPostKeys) {
          const cached = getCachedJson(key);
          if (cached) {
            setPost(cached);
            setStatus("ready");
            hasCached = true;
            break;
          }
        }
      }
    }
    if (!hasCached || force) {
      setStatus("loading");
    }
    const authToken = token;
    fetch(`/api/blog/${slug}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((res) => res.json())
      .then((payload) => {
        const data = payload?.data ?? payload;
        if (!data || payload?.success === false) {
          setStatus("error");
          return;
        }
        setPost(data);
        cacheUserKeys.forEach((key) => setPostCache(`${key}:${slug}`, data));
        localPostKeys.forEach((key) => setCachedJson(key, data));
        setStatus("ready");
      })
      .catch(() => {
        if (!hasCached || force) {
          setStatus("error");
        }
      });
  }

  function loadComments(options: { force?: boolean } = {}) {
    const { force = false } = options;
    if (!slug) return;
    let hasCached = false;
    if (!force) {
      for (const key of cacheUserKeys) {
        const cached = getCommentsCache(`${key}:${slug}`);
        if (cached) {
          setComments(Array.isArray(cached) ? cached : []);
          setCommentListStatus("ready");
          hasCached = true;
          break;
        }
      }
      if (!hasCached) {
        for (const key of localCommentKeys) {
          const cached = getCachedJson(key);
          if (cached) {
            setComments(Array.isArray(cached) ? cached : []);
            setCommentListStatus("ready");
            hasCached = true;
            break;
          }
        }
      }
    }
    if (!hasCached || force) {
      setCommentListStatus("loading");
    }
    fetch(`/api/blog/${slug}/comments`)
      .then((res) => res.json())
      .then((payload) => {
        const list = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
        setComments(list);
        cacheUserKeys.forEach((key) => setCommentsCache(`${key}:${slug}`, list));
        localCommentKeys.forEach((key) => setCachedJson(key, list));
        setCommentListStatus("ready");
      })
      .catch(() => {
        if (!hasCached || force) {
          setComments([]);
          setCommentListStatus("error");
        }
      });
  }


  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      clearAllCaches();
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("cache:blog:") || key.startsWith("cache:post:") || key.startsWith("cache:comments:") || key.startsWith("cache:favorites:") || key.startsWith("cache:profile:")) {
            localStorage.removeItem(key);
          }
        });
      } catch { }
      loadPost({ force: true });
      loadComments({ force: true });
    };
    window.addEventListener("profile-updated", handler as EventListener);
    window.addEventListener("blog-updated", handler as EventListener);
    return () => {
      window.removeEventListener("profile-updated", handler as EventListener);
      window.removeEventListener("blog-updated", handler as EventListener);
    };
  }, [slug, cacheKeySignature]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ts = localStorage.getItem("profile_updated_at");
    if (ts) {
      loadPost({ force: true });
      loadComments({ force: true });
    }
  }, []);

  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    const viewedKey = `post:viewed:${slug}`;
    if (sessionStorage.getItem(viewedKey)) return;
    fetch(`/api/blog/${slug}/view`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        sessionStorage.setItem(viewedKey, "1");
        const viewCount = data?.data?.view_count ?? data?.view_count;
        if (typeof viewCount === "number") {
          setPost((prev: any) => (prev ? { ...prev, view_count: viewCount } : prev));
        }
      })
      .catch(() => { });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    loadPost();
    loadComments();
  }, [slug, cacheKeySignature]);

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;
    const refreshNow = () => {
      loadPost({ force: true });
      loadComments({ force: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshNow();
      }
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshNow();
      }
    }, 15000);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slug, cacheKeySignature]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(Array.isArray(data?.data?.items) ? data.data.items : []);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMetricsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PostMetricsUpdateDetail>).detail;
      if (!detail?.slug || !slug || detail.slug !== slug) return;
      setPost((prev: any) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          ...(detail.like_count !== undefined ? { like_count: detail.like_count } : {}),
          ...(detail.dislike_count !== undefined ? { dislike_count: detail.dislike_count } : {}),
          ...(detail.favorite_count !== undefined ? { favorite_count: detail.favorite_count } : {}),
          ...(detail.comment_count !== undefined ? { comment_count: detail.comment_count } : {}),
          ...(detail.favorited_by_me !== undefined ? { favorited_by_me: detail.favorited_by_me } : {}),
        };
        cacheUserKeys.forEach((key) => setPostCache(`${key}:${slug}`, next));
        localPostKeys.forEach((key) => setCachedJson(key, next));
        return next;
      });
    };
    window.addEventListener(POST_METRICS_UPDATED_EVENT, onMetricsUpdated as EventListener);
    return () => window.removeEventListener(POST_METRICS_UPDATED_EVENT, onMetricsUpdated as EventListener);
  }, [slug, cacheKeySignature]);

  useEffect(() => {
    if (post) {
      setEditTitle(post.title || "");
      setEditContent(post.content || "");
      setEditTags(post.tags || "");
      setEditCategoryId(post.category_id ? String(post.category_id) : "");
    }
  }, [post]);

  async function handleLike() {
    const authToken = token;
    if (!authToken || !slug) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/blog/${slug}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      return;
    }
    const payload = await res.json().catch(() => ({}));
    const data = payload?.data || payload;
    const next = {
      like_count: data?.like_count ?? post?.like_count,
      dislike_count: data?.dislike_count ?? post?.dislike_count,
      favorite_count: data?.favorite_count ?? post?.favorite_count,
      comment_count: data?.comment_count ?? post?.comment_count,
      favorited_by_me: data?.favorited ?? post?.favorited_by_me,
    };
    setPost((prev: any) => (prev ? { ...prev, ...next } : prev));
    emitPostMetricsUpdated({ slug, ...next });
  }

  async function handleFavorite() {
    const authToken = token;
    if (!authToken || !slug) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/blog/${slug}/favorite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      return;
    }
    const payload = await res.json().catch(() => ({}));
    const data = payload?.data || payload;
    const next = {
      like_count: data?.like_count ?? post?.like_count,
      dislike_count: data?.dislike_count ?? post?.dislike_count,
      favorite_count: data?.favorite_count ?? post?.favorite_count,
      comment_count: data?.comment_count ?? post?.comment_count,
      favorited_by_me: data?.favorited ?? post?.favorited_by_me,
    };
    setPost((prev: any) => (prev ? { ...prev, ...next } : prev));
    emitPostMetricsUpdated({ slug, ...next });
  }

  async function handleDislike() {
    const authToken = token;
    if (!authToken || !slug) {
      setCommentStatus("请先登录后再操作。");
      return;
    }
    const res = await fetch(`/api/blog/${slug}/dislike`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      return;
    }
    const payload = await res.json().catch(() => ({}));
    const data = payload?.data || payload;
    const next = {
      like_count: data?.like_count ?? post?.like_count,
      dislike_count: data?.dislike_count ?? post?.dislike_count,
      favorite_count: data?.favorite_count ?? post?.favorite_count,
      comment_count: data?.comment_count ?? post?.comment_count,
      favorited_by_me: data?.favorited ?? post?.favorited_by_me,
    };
    setPost((prev: any) => (prev ? { ...prev, ...next } : prev));
    emitPostMetricsUpdated({ slug, ...next });
  }

  function scheduleCommentsRefresh() {
    if (refreshCommentsTimer.current) {
      clearTimeout(refreshCommentsTimer.current);
    }
    refreshCommentsTimer.current = setTimeout(() => {
      loadComments({ force: true });
    }, 800);
  }

  async function handleComment(event: React.FormEvent) {
    event.preventDefault();
    if (commentLoading) return;
    setCommentStatus("");
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentStatus("请输入评论内容。");
      return;
    }
    if (!slug) return;
    setCommentLoading(true);
    try {
      const authToken = token;
      const res = await fetch(`/api/blog/${slug}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          content: replyTo
            ? trimmed.startsWith("@")
              ? trimmed
              : `@${replyTo.author_name || replyTo.author} ${trimmed}`
            : trimmed,
          author: profile?.nickname || profile?.username || "访客",
          parent_id: replyTo?.root_id || replyTo?.id || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommentStatus(data?.error?.message || data?.detail || "评论失败。");
        return;
      }
      setCommentText("");
      setReplyTo(null);
      setCommentStatus("评论已发布。");
      setCommentPage(1);
      loadComments({ force: true });
      loadPost({ force: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
      }
    } finally {
      setCommentLoading(false);
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!confirm("确定要删除这条评论吗？")) return;
    const authToken = token;
    if (!authToken) return;

    try {
      const res = await fetch(`/api/comment/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        alert("删除失败");
        return;
      }
      loadComments({ force: true });
      loadPost({ force: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
      }
    } catch (e) {
      console.error(e);
      alert("删除出错");
    }
  }

  async function handleUpdateComment(commentId: number) {
    if (!editingCommentContent.trim()) return;
    const authToken = token;
    if (!authToken) return;

    try {
      const res = await fetch(`/api/comment/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: editingCommentContent }),
      });
      if (!res.ok) {
        alert("更新失败");
        return;
      }
      setEditingCommentId(null);
      setEditingCommentContent("");
      loadComments({ force: true });
      loadPost({ force: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
      }
    } catch (e) {
      console.error(e);
      alert("更新出错");
    }
  }

  async function handleSaveEdit() {
    setEditStatus("");
    if (!editTitle.trim() || !editContent.trim()) {
      setEditStatus("标题和内容不能为空。");
      return;
    }
    const authToken = token;
    if (!authToken || !slug) {
      setEditStatus("请先登录。");
      return;
    }
    const res = await fetch(`/api/blog/${slug}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        title: editTitle,
        content: editContent,
        tags: editTags,
        category_id: editCategoryId ? Number(editCategoryId) : null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditStatus(data?.error?.message || data?.detail || "保存失败。");
      return;
    }
    setIsEditing(false);
    clearPostCache(slug);
    clearAllListCache();
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("cache:blog:") || key.startsWith("cache:post:")) {
          localStorage.removeItem(key);
        }
      });
    } catch { }
    loadPost({ force: true });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("blog-updated", { detail: { slug } }));
    }
  }

  function insertImageMarkup(url: string, widthValue: string) {
    const markup = widthValue
      ? `<img src="${url}" style="max-width: 100%; width: ${widthValue};" />`
      : `![](${url})`;
    setEditContent((prev) => `${prev}\n\n${markup}\n`);
  }

  function handleImageSelect(file: File | undefined, replaceSrc: string | null = null) {
    if (!file) return;
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingPreviewUrl(preview);
    setSelectedImage(replaceSrc || null);
    setShowSizeModal(true);
  }

  async function uploadImage(file: File) {
    const authToken = token;
    if (!authToken) {
      setEditStatus("请先登录。");
      return null;
    }
    const resized = await resizeImageFile(file, 1600);
    const formData = new FormData();
    formData.append("file", resized);
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    if (!res.ok) {
      setEditStatus("上传失败。");
      return null;
    }
    const data = await res.json();
    return data?.data?.url || data?.url || null;
  }

  function removeSelectedImage() {
    if (!selectedImage) return;
    const escaped = selectedImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markdownPattern = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g");
    const htmlPattern = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "g");
    setEditContent((prev) => prev.replace(markdownPattern, "").replace(htmlPattern, ""));
    setSelectedImage(null);
    setShowSizeModal(false);
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl("");
    }
    setPendingImageFile(null);
  }

  function getImageWidthFromContent(src: string | null) {
    if (!src) return null;
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const htmlPattern = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "g");
    const match = editContent.match(htmlPattern);
    if (!match) return null;
    const tag = match[0];
    const widthMatch = tag.match(/width:\s*([^;"]+)/i);
    if (!widthMatch) return null;
    return widthMatch[1].trim();
  }

  function applyImageSize(widthValue: string) {
    if (!selectedImage) return;
    const escaped = selectedImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const htmlPattern = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "g");
    const markdownPattern = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g");
    const replacement = `<img src="${selectedImage}" style="max-width: 100%; width: ${widthValue};" />`;
    const updated = editContent
      .replace(htmlPattern, replacement)
      .replace(markdownPattern, replacement);
    setEditContent(updated);
  }

  function replaceImageSrc(oldSrc: string, newSrc: string, widthValue: string) {
    const escaped = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const htmlPattern = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "g");
    const markdownPattern = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g");
    const replacement = `<img src="${newSrc}" style="max-width: 100%; width: ${widthValue};" />`;
    const updated = editContent
      .replace(htmlPattern, replacement)
      .replace(markdownPattern, replacement);
    setEditContent(updated);
    setSelectedImage(newSrc);
  }

  const tagList: string[] = (post?.tags || "")
    .split(/[,，]/)
    .map((tag: string) => tag.trim())
    .filter(Boolean);

  const readingStats = useMemo(() => {
    const text = String(post?.content || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/[#>*_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const length = text.length;
    const minutes = Math.max(1, Math.ceil(length / 400));
    return { length, minutes };
  }, [post?.content]);

  const { html: markdownHtml, toc: tocItems } = useMemo(() => {
    const source = String(post?.content || "");
    if (!hasMarkdownSyntax(source)) {
      return { html: sanitizeHtml(renderPlainTextHtml(source)), toc: [] as Array<{ id: string; text: string; level: number }> };
    }
    const items: Array<{ id: string; text: string; level: number }> = [];
    const slugCounts = new Map<string, number>();
    const renderer = new marked.Renderer();
    renderer.heading = (text: string, level: number, raw: string) => {
      const base = slugify(raw || text);
      const count = slugCounts.get(base) || 0;
      const nextCount = count + 1;
      slugCounts.set(base, nextCount);
      const id = count ? `${base}-${nextCount}` : base || `section-${items.length + 1}`;
      items.push({ id, text, level });
      return `<h${level} id="${id}">${text}</h${level}>`;
    };
    renderer.image = (href: string | null, title: string | null, text: string) => {
      const safeTitle = title ? ` title="${title}"` : "";
      const alt = text || "";
      return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} style="max-width: 100%; height: auto;" />`;
    };
    const html = marked.parse(source, { renderer, gfm: true, breaks: true });
    return { html: sanitizeHtml(String(html)), toc: items };
  }, [post?.content, sanitizeHtml]);

  const editPreviewHtml = useMemo(() => {
    const source = String(editContent || "");
    if (!hasMarkdownSyntax(source)) {
      return sanitizeHtml(renderPlainTextHtml(source));
    }
    const renderer = new marked.Renderer();
    renderer.image = (href: string | null, title: string | null, text: string) => {
      const safeTitle = title ? ` title="${title}"` : "";
      const alt = text || "";
      return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} style="max-width: 100%; height: auto;" />`;
    };
    const html = marked.parse(source, { renderer, gfm: true, breaks: true });
    return sanitizeHtml(String(html));
  }, [editContent, sanitizeHtml]);

  function buildCommentTree(list: any[]) {
    const nodes = new Map<string, any>();
    const roots: any[] = [];
    list.forEach((item) => {
      nodes.set(item.id, { ...item, children: [] });
    });
    nodes.forEach((node) => {
      if (node.parent_id && nodes.has(node.parent_id)) {
        const parent = nodes.get(node.parent_id);
        node.reply_to = parent.author_name || parent.author || "访客";
        node.reply_to_id = parent.id;
        node.root_id = parent.root_id || parent.id;
        parent.children.push(node);
      } else {
        node.root_id = node.id;
        roots.push(node);
      }
    });
    const sortByDate = (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const sortTree = (items: any[]) => {
      items.sort(sortByDate);
      items.forEach((child) => sortTree(child.children));
    };
    sortTree(roots);
    return roots;
  }

  const commentRoots = buildCommentTree(comments);
  const totalCommentPages = Math.max(1, Math.ceil(commentRoots.length / commentsPerPage));
  const pagedRoots = commentRoots.slice(
    (commentPage - 1) * commentsPerPage,
    commentPage * commentsPerPage,
  );

  function handleReplyClick(comment: any) {
    const name = comment.author_name || comment.author || "访客";
    const prefix = `@${name} `;
    setReplyTo(comment);
    setCommentText((value) => (value.startsWith(prefix) ? value : prefix));
  }

  function renderComment(node: any, depth = 0) {
    const isReply = depth > 0;
    const isExpanded = !!expandedReplies[node.id];
    const replySlice = isExpanded ? node.children : node.children.slice(0, 5);
    return (
      <div
        key={node.id}
        id={`comment-${node.id}`}
        className={`comment-item p-4 border-b border-subtle ${isReply ? "ml-8 pl-4 border-l-2 border-l-subtle" : ""}`}
      >
        <div className="flex gap-4">
          <UserHoverCard username={node.author}>
            {node.author_avatar ? (
              <img
                src={getThumbnailUrl(node.author_avatar, 64)}
                alt={node.author_name}
                loading="lazy"
                decoding="async"
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="avatar-fallback w-8 h-8 text-xs">{node.author_name?.[0] || "U"}</div>
            )}
          </UserHoverCard>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <UserHoverCard username={node.author} disableHover={true}>
                <strong className="text-sm cursor-pointer hover:text-blue-400">{node.author_name || node.author}</strong>
              </UserHoverCard>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">Lv1</span>
              <span className="text-xs text-muted ml-auto">{new Date(node.created_at).toLocaleString()}</span>
            </div>
            {node.reply_to && (
              <div className="text-xs text-muted mb-2">
                回复 <a href={`#comment-${node.reply_to_id}`} className="text-accent hover:underline">@{node.reply_to}</a>
              </div>
            )}
            {editingCommentId === node.id ? (
              <div className="mb-2">
                <textarea
                  className="input w-full p-2 text-sm mb-2"
                  rows={3}
                  value={editingCommentContent}
                  onChange={(e) => setEditingCommentContent(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleUpdateComment(node.id)}
                  >
                    保存
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentContent("");
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed mb-3 text-primary">{node.content}</p>
            )}
            <div className="flex gap-3 text-xs text-muted">
              <button
                className="hover:text-primary transition-colors cursor-pointer"
                type="button"
                onClick={() => {
                  const authToken = token;
                  if (!authToken) {
                    setCommentStatus("请先登录后再操作。");
                    return;
                  }
                  fetch(`/api/comment/${node.id}/like`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` },
                  })
                    .then(() => scheduleCommentsRefresh())
                    .catch(() => { });
                }}
              >
                <ThumbsUpIcon className="inline" /> {node.like_count ?? 0}
              </button>
              <button
                className="hover:text-primary transition-colors cursor-pointer"
                type="button"
                onClick={() => {
                  const authToken = token;
                  if (!authToken) {
                    setCommentStatus("请先登录后再操作。");
                    return;
                  }
                  fetch(`/api/comment/${node.id}/dislike`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` },
                  })
                    .then(() => scheduleCommentsRefresh())
                    .catch(() => { });
                }}
              >
                <ThumbsDownIcon className="inline" /> {node.dislike_count ?? 0}
              </button>
              <button
                className="hover:text-primary transition-colors cursor-pointer"
                type="button"
                onClick={() => handleReplyClick(node)}
              >
                <MessageCircleIcon className="inline" /> 回复
              </button>
              {isAdmin && (
                <>
                  <button
                    className="hover:text-primary transition-colors cursor-pointer ml-2"
                    type="button"
                    onClick={() => {
                      setEditingCommentId(node.id);
                      setEditingCommentContent(node.content);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="hover:text-red-500 transition-colors cursor-pointer"
                    type="button"
                    onClick={() => handleDeleteComment(node.id)}
                  >
                    删除
                  </button>
                </>
              )}
            </div>

            {depth === 0 && node.children.length > 0 && (
              <div className="mt-4 space-y-4">
                {replySlice.map((child: any) => renderComment(child, depth + 1))}
                {node.children.length > 5 && (
                  <button
                    className="text-xs text-accent hover:underline mt-2"
                    type="button"
                    onClick={() =>
                      setExpandedReplies((prev) => ({
                        ...prev,
                        [node.id]: !isExpanded,
                      }))
                    }
                  >
                    {isExpanded
                      ? "收起回复"
                      : `更多回复 (${node.children.length - 5})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="blog-post-page">
      <div className="post-toolbar mb-4 flex justify-between items-center">
        <div>
          {canEdit && (
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setIsEditing((value) => !value)}
            >
              {isEditing ? "取消编辑" : "编辑"}
            </button>
          )}
        </div>
        <Link className="btn-ghost" href="/">
          返回主页
        </Link>
      </div>

      {post?.title && <h1 className="post-title text-3xl font-bold mb-4">{post.title}</h1>}

      {post && (
        <div className="post-hero flex flex-col gap-4 mb-8 pb-8 border-b border-subtle">
          <div className="post-hero-main flex items-center justify-between">
            <div className="post-author-block flex items-center gap-3">
              <UserHoverCard username={post.author}>
                {post.author_avatar ? (
                  <img
                    src={getThumbnailUrl(post.author_avatar, 96)}
                    alt={post.author_name}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="avatar-fallback w-10 h-10 rounded-full flex items-center justify-center text-sm">
                    {post.author_name?.[0] || "U"}
                  </div>
                )}
              </UserHoverCard>
              <div className="flex flex-col">
                <UserHoverCard username={post.author} disableHover={true}>
                  <span className="post-author-name font-bold text-lg cursor-pointer">{post.author_name || post.author}</span>
                </UserHoverCard>
                <div className="post-author-meta flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{new Date(post.created_at).toLocaleString()}</span>
                  <span>浏览 {post.view_count ?? 0}</span>
                  <span>阅读 {readingStats.minutes} 分钟</span>
                  <span>{readingStats.length} 字</span>
                </div>
              </div>
            </div>

            <div className="post-hero-actions flex items-center gap-2">
              <button className="btn-ghost btn-sm" type="button" onClick={handleLike}>
                <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
              </button>
              <button
                className="btn-ghost btn-sm"
                type="button"
                onClick={handleDislike}
              >
                <ThumbsDownIcon className="inline" /> {post.dislike_count ?? 0}
              </button>
              <button
                className={`btn-ghost btn-sm ${post.favorited_by_me ? "text-accent" : ""}`}
                type="button"
                onClick={handleFavorite}
              >
                <BookmarkIcon filled={post.favorited_by_me} className="inline" /> {post.favorite_count ?? 0}
              </button>
              <span className="btn-ghost btn-sm cursor-default">
                <MessageCircleIcon className="inline" /> {comments.length ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}
      {post && (
        <div className="post-meta-stack mb-6">
          <div className="category-row">
            <span className="category-chip">{post?.category_name || "未分类"}</span>
          </div>
          {tagList.length > 0 && (
            <div className="tag-list">
              {tagList.map((tag) => (
                <span key={tag} className="tag-pill">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {status === "error" && <p>加载失败，请稍后再试。</p>}
      {isEditing && (
        <section className="card form">
          <label className="block mb-4">
            <span className="block text-sm font-medium mb-1">标题</span>
            <input
              className="input"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="标题"
            />
          </label>
          <label className="block mb-4">
            <span className="block text-sm font-medium mb-1">分类</span>
            <select
              className="input"
              value={editCategoryId}
              onChange={(event) => setEditCategoryId(event.target.value)}
            >
              <option value="">未分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block mb-4">
            <span className="block text-sm font-medium mb-1">标签</span>
            <input
              className="input"
              value={editTags}
              onChange={(event) => setEditTags(event.target.value)}
              placeholder="tag1, tag2"
            />
          </label>
          <label>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">内容</span>
              <div className="flex gap-2 items-center">
                <input
                  className="input"
                  style={{ width: "200px", display: "inline-block", padding: "4px 8px", fontSize: "0.8rem" }}
                  value={imageWidth}
                  onChange={(event) => setImageWidth(event.target.value)}
                  placeholder="图片宽度..."
                />
                <label className="btn-ghost btn-sm cursor-pointer m-0">
                  上传图片
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleImageSelect(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <textarea
              className="input"
              rows={10}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              placeholder="写下内容..."
            />
          </label>
          <input
            ref={imageReplaceInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && selectedImage) {
                handleImageSelect(file, selectedImage);
              }
              event.target.value = "";
            }}
          />
          {editStatus && <p className="text-accent mb-4">{editStatus}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" type="button" onClick={handleSaveEdit}>
              保存修改
            </button>
            <button className="btn-ghost" type="button" onClick={() => setIsEditing(false)}>
              取消
            </button>
          </div>
        </section>
      )}
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
            <article className="markdown" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
          </div>
          {post.created_at && (
            <div className="post-footer">
              <span className="muted">发布时间：{new Date(post.created_at).toLocaleString()}</span>
            </div>
          )}
        </>
      )}

      <section className="card comments post-comments">
        <form className="form" onSubmit={handleComment}>
          <label>
            评论
            <textarea
              rows={4}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleComment(event);
                }
              }}
              placeholder={replyTo ? `回复 @${replyTo.author_name || replyTo.author}` : "写下你的观点... (按 Enter 发送)"}
            />
          </label>
          {!isAuthenticated && (
            <p className="text-xs text-muted mt-2">未登录将以“访客”身份发表评论。</p>
          )}
          {commentStatus && <p className="status">{commentStatus}</p>}
          <div className="flex justify-end mt-2">
            <button className="btn-primary" type="submit" disabled={commentLoading}>
              {commentLoading ? "提交中..." : "评论"}
            </button>
          </div>
        </form>

        <div className="comment-list">
          {commentListStatus === "error" && <p className="text-accent">评论加载失败，请刷新重试。</p>}
          {commentListStatus === "ready" && commentRoots.length === 0 && <p className="muted">暂无评论。</p>}
          {pagedRoots.map((comment) => renderComment(comment))}
        </div>
        {totalCommentPages > 1 && (
          <div className="pagination">
            <button
              className="button ghost"
              type="button"
              onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
              disabled={commentPage === 1}
            >
              上一页
            </button>
            <span className="muted">
              第 {commentPage} / {totalCommentPages} 页
            </span>
            <button
              className="button ghost"
              type="button"
              onClick={() => setCommentPage((p) => Math.min(totalCommentPages, p + 1))}
              disabled={commentPage === totalCommentPages}
            >
              下一页
            </button>
          </div>
        )}
      </section>
    </div>
  );
}


