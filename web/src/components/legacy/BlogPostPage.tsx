
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getThumbnailUrl } from "@/utils/url";
import { ThumbsUpIcon, ThumbsDownIcon, BookmarkIcon, MessageCircleIcon } from "@/components/Icons";
import { marked } from "marked";
import { useAuth } from "@/app/providers";
import {
  clearAllListCache,
  clearPostCache,
  getCommentsCache,
  getPostCache,
  setCommentsCache,
  setPostCache,
} from "@/utils/memoryStore";
import { resizeImageFile } from "@/utils/image";
import { getCachedJson, setCachedJson } from "@/utils/cache";

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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageSizePercent, setImageSizePercent] = useState(100);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const editPreviewRef = useRef<HTMLDivElement | null>(null);
  const imageReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const refreshCommentsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user: profile, token, isAuthenticated } = useAuth();

  const canEdit = profile?.username && post?.author && profile.username === post.author;
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

  function loadPost(options: { force?: boolean } = {}) {
    const { force = false } = options;
    if (!slug) return;
    if (!force) {
      for (const key of cacheUserKeys) {
        const cached = getPostCache(`${key}:${slug}`);
        if (cached) {
          setPost(cached);
          setStatus("ready");
          return;
        }
      }
      for (const key of localPostKeys) {
        const cached = getCachedJson(key);
        if (cached) {
          setPost(cached);
          setStatus("ready");
          return;
        }
      }
    }
    const authToken = token;
    fetch(`/api/blog/${slug}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        setPost(data);
        cacheUserKeys.forEach((key) => setPostCache(`${key}:${slug}`, data));
        localPostKeys.forEach((key) => setCachedJson(key, data));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  function loadComments(options: { force?: boolean } = {}) {
    const { force = false } = options;
    if (!slug) return;
    if (!force) {
      for (const key of cacheUserKeys) {
        const cached = getCommentsCache(`${key}:${slug}`);
        if (cached) {
          setComments(Array.isArray(cached) ? cached : []);
          setCommentListStatus("ready");
          return;
        }
      }
      for (const key of localCommentKeys) {
        const cached = getCachedJson(key);
        if (cached) {
          setComments(Array.isArray(cached) ? cached : []);
          setCommentListStatus("ready");
          return;
        }
      }
    }
    setCommentListStatus("loading");
    fetch(`/api/blog/${slug}/comments`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        cacheUserKeys.forEach((key) => setCommentsCache(`${key}:${slug}`, list));
        localCommentKeys.forEach((key) => setCachedJson(key, list));
        setCommentListStatus("ready");
      })
      .catch(() => {
        setComments([]);
        setCommentListStatus("error");
      });
  }

  useEffect(() => {
    if (!slug) return;
    let cachedPost: any = null;
    for (const key of cacheUserKeys) {
      cachedPost = getPostCache(`${key}:${slug}`);
      if (cachedPost) break;
    }
    if (!cachedPost) {
      for (const key of localPostKeys) {
        cachedPost = getCachedJson(key);
        if (cachedPost) break;
      }
    }
    let cachedComments: any = null;
    for (const key of cacheUserKeys) {
      cachedComments = getCommentsCache(`${key}:${slug}`);
      if (cachedComments) break;
    }
    if (!cachedComments) {
      for (const key of localCommentKeys) {
        cachedComments = getCachedJson(key);
        if (cachedComments) break;
      }
    }
    if (cachedPost) {
      setPost(cachedPost);
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    if (cachedComments) {
      setComments(Array.isArray(cachedComments) ? cachedComments : []);
      setCommentListStatus("ready");
    }
    if (!cachedPost) {
      loadPost({ force: true });
    }
    if (!cachedComments) {
      loadComments({ force: true });
    }
  }, [slug, cacheKeySignature]);

  useEffect(() => {
    if (post) {
      setEditTitle(post.title || "");
      setEditContent(post.content || "");
      setEditTags(post.tags || "");
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
    await res.json().catch(() => ({}));
    loadPost({ force: true });
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
        setCommentStatus(data.detail || "评论失败。");
        return;
      }
      setCommentText("");
      setReplyTo(null);
      setCommentStatus("评论已发布。");
      setCommentPage(1);
      loadComments({ force: true });
      loadPost({ force: true });
    } finally {
      setCommentLoading(false);
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
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditStatus(data.detail || "保存失败。");
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
    } catch {}
    loadPost({ force: true });
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
    return data.url || null;
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

  const tagList = (post?.tags || "")
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
    const items: Array<{ id: string; text: string; level: number }> = [];
    const slugCounts = new Map<string, number>();
    const renderer = new marked.Renderer();
    renderer.heading = (text, level, raw) => {
      const base = slugify(raw || text);
      const count = slugCounts.get(base) || 0;
      const nextCount = count + 1;
      slugCounts.set(base, nextCount);
      const id = count ? `${base}-${nextCount}` : base || `section-${items.length + 1}`;
      items.push({ id, text, level });
      return `<h${level} id="${id}">${text}</h${level}>`;
    };
    renderer.image = (href, title, text) => {
      const safeTitle = title ? ` title="${title}"` : "";
      const alt = text || "";
      return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} style="max-width: 100%; height: auto;" />`;
    };
    const html = marked.parse(post?.content || "", { renderer });
    return { html, toc: items };
  }, [post?.content]);

  const editPreviewHtml = useMemo(() => {
    const renderer = new marked.Renderer();
    renderer.image = (href, title, text) => {
      const safeTitle = title ? ` title="${title}"` : "";
      const alt = text || "";
      return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} style="max-width: 100%; height: auto;" />`;
    };
    return marked.parse(editContent || "", { renderer });
  }, [editContent]);

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
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <strong className="text-sm">{node.author_name || node.author}</strong>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">Lv1</span>
              <span className="text-xs text-muted ml-auto">{new Date(node.created_at).toLocaleString()}</span>
            </div>
            {node.reply_to && (
              <div className="text-xs text-muted mb-2">
                回复 <a href={`#comment-${node.reply_to_id}`} className="text-accent hover:underline">@{node.reply_to}</a>
              </div>
            )}
            <p className="text-sm leading-relaxed mb-3 text-primary">{node.content}</p>
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
                    .catch(() => {});
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
                    .catch(() => {});
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
          返回讨论区
        </Link>
      </div>

      {post?.title && <h1 className="text-3xl font-bold mb-4">{post.title}</h1>}

      {post && (
        <div className="flex flex-col gap-4 mb-8 pb-8 border-b border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
              <div className="flex flex-col">
                <span className="font-bold text-lg">{post.author_name || post.author}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{new Date(post.created_at).toLocaleString()}</span>
                  <span>阅读 {readingStats.minutes} 分钟</span>
                  <span>{readingStats.length} 字</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-ghost btn-sm" type="button" onClick={handleLike}>
                <ThumbsUpIcon className="inline" /> {post.like_count ?? 0}
              </button>
              <button
                className={`btn-ghost btn-sm ${post.favorited_by_me ? "text-accent" : ""}`}
                type="button"
                onClick={() => {
                  const authToken = token;
                  if (!authToken) {
                    router.push("/login");
                    return;
                  }
                  fetch(`/api/blog/${slug}/favorite`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` },
                  })
                    .then((res) => res.json())
                    .then(() => loadPost({ force: true }))
                    .catch(() => {});
                }}
              >
                <BookmarkIcon filled={post.favorited_by_me} className="inline" /> {post.favorite_count ?? 0}
              </button>
              <button
                className="btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  const authToken = token;
                  if (!authToken) {
                    setCommentStatus("请先登录后再操作。");
                    return;
                  }
                  fetch(`/api/blog/${slug}/dislike`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` },
                  })
                    .then((res) => res.json())
                    .then(() => loadPost({ force: true }))
                    .catch(() => {});
                }}
              >
                <ThumbsDownIcon className="inline" /> {post.dislike_count ?? 0}
              </button>
              <span className="btn-ghost btn-sm cursor-default">
                <MessageCircleIcon className="inline" /> {comments.length ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}
      {tagList.length > 0 && (
        <div className="tag-list mb-6">
          {tagList.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
          ))}
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
          <div className="card image-editor mt-4 mb-4">
            <div className="flex justify-between items-center mb-2 text-sm text-muted">
              <span>点击预览中的图片进行编辑。</span>
              {selectedImage && (
                <div className="flex gap-2">
                  <button
                    className="btn-ghost btn-sm"
                    type="button"
                    onClick={() => imageReplaceInputRef.current?.click()}
                  >
                    替换
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    type="button"
                    onClick={removeSelectedImage}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
            <div
              ref={editPreviewRef}
              className="markdown markdown-preview p-4 border border-subtle rounded-lg"
              dangerouslySetInnerHTML={{ __html: editPreviewHtml }}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target instanceof HTMLImageElement) {
                  const src = target.getAttribute("src");
                  setSelectedImage(src);
                  setPendingImageFile(null);
                  if (pendingPreviewUrl) {
                    URL.revokeObjectURL(pendingPreviewUrl);
                    setPendingPreviewUrl("");
                  }
                  const currentWidth = getImageWidthFromContent(src);
                  if (currentWidth && currentWidth.endsWith("%")) {
                    const parsed = parseInt(currentWidth.replace("%", ""), 10);
                    if (!Number.isNaN(parsed)) {
                      setImageSizePercent(parsed);
                    }
                  }
                  setShowSizeModal(true);
                }
              }}
            />
          </div>
          {showSizeModal && (selectedImage || pendingImageFile) && (
            <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.8)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="card" style={{ width: "400px", maxWidth: "90%" }}>
                <h3 className="text-lg font-bold mb-4">调整图片大小</h3>
                <div className="mb-4 bg-black/20 p-2 rounded flex justify-center" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <img
                    src={pendingPreviewUrl || selectedImage || ""}
                    alt="preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      width: imageWidth.trim()
                        ? imageWidth.trim()
                        : `${imageSizePercent}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    className="flex-1"
                    style={{ flex: 1 }}
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
                  {selectedImage && (
                    <>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => imageReplaceInputRef.current?.click()}
                      >
                        替换
                      </button>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={removeSelectedImage}
                      >
                        删除
                      </button>
                    </>
                  )}
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={async () => {
                      const widthValue = imageWidth.trim()
                        ? imageWidth.trim()
                        : `${imageSizePercent}%`;
                      if (selectedImage) {
                        applyImageSize(widthValue);
                      } else if (pendingImageFile) {
                        const url = await uploadImage(pendingImageFile);
                        if (url) {
                          insertImageMarkup(url, widthValue);
                        }
                      }

                      if (pendingPreviewUrl) {
                        URL.revokeObjectURL(pendingPreviewUrl);
                        setPendingPreviewUrl("");
                      }
                      setPendingImageFile(null);
                      setShowSizeModal(false);
                    }}
                  >
                    确认
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      if (pendingPreviewUrl) {
                        URL.revokeObjectURL(pendingPreviewUrl);
                        setPendingPreviewUrl("");
                      }
                      setPendingImageFile(null);
                      setShowSizeModal(false);
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
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

      <section className="card comments">
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
          <div className="comment-form-actions">
            <button className="btn-primary" type="submit" style={{ display: "flex", alignItems: "center", gap: "6px" }} disabled={commentLoading}>
              <span>评论</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
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

