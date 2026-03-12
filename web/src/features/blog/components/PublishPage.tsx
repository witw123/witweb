/**
 * PublishPage - 文章发布/编辑页面
 *
 * 提供 Markdown 写作、预览、图片上传和本地草稿能力。
 * 同一页面同时承担“新建文章”和“编辑已有文章”两种模式，因此需要在草稿恢复、
 * 提交和本地存储逻辑上严格区分场景。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { uploadImageRequest } from "@/lib/upload-image-client";
import { resizeImageFile } from "@/utils/image";
import { cn } from "@/lib/utils/cn";
import { useCategories, usePublishPost, useMarkdownEditor, useMarkdownPreview } from "../hooks";
import { MarkdownToolbar, type ToolbarAction } from "./MarkdownToolbar";
import { EditorStatusBar } from "./EditorStatusBar";
import { CoverImageUploader } from "./CoverImageUploader";

const AGENT_DRAFT_KEY = "agent_publish_draft_v1";
const LOCAL_DRAFT_KEY_PREFIX = "publish_local_draft_v1";

type LocalPublishDraft = {
  title: string;
  tags: string;
  content: string;
  categoryId: string;
  excerpt: string;
  coverImageUrl: string;
  updatedAt: string;
};

/**
 * 读取从 AI 创作代理导入的草稿
 *
 * 只有 URL 中显式带上 `from_agent=1` 时才尝试读取，避免误加载旧代理草稿。
 */
function readImportedDraft(): { title: string; content: string; tags: string; imported: boolean } {
  if (typeof window === "undefined") {
    return { title: "", content: "", tags: "", imported: false };
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("from_agent") !== "1") {
    return { title: "", content: "", tags: "", imported: false };
  }

  try {
    const raw = localStorage.getItem(AGENT_DRAFT_KEY);
    if (!raw) return { title: "", content: "", tags: "", imported: false };
    const draft = JSON.parse(raw) as { title?: string; content?: string; tags?: string };
    return {
      title: draft.title || "",
      content: draft.content || "",
      tags: draft.tags || "",
      imported: true,
    };
  } catch {
    return { title: "", content: "", tags: "", imported: false };
  }
}

/** 草稿按用户名隔离，避免多人共用设备时互相覆盖。 */
function getLocalDraftKey(username?: string): string {
  const suffix = username?.trim() ? username.trim().toLowerCase() : "anon";
  return `${LOCAL_DRAFT_KEY_PREFIX}:${suffix}`;
}

function readLocalDraft(username?: string): LocalPublishDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getLocalDraftKey(username));
    if (!raw) return null;

    const draft = JSON.parse(raw) as Partial<LocalPublishDraft>;
    return {
      title: draft.title || "",
      tags: draft.tags || "",
      content: draft.content || "",
      categoryId: draft.categoryId || "",
      excerpt: draft.excerpt || "",
      coverImageUrl: draft.coverImageUrl || "",
      updatedAt: draft.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function saveLocalDraft(username: string | undefined, draft: Omit<LocalPublishDraft, "updatedAt">): string {
  const updatedAt = new Date().toISOString();
  if (typeof window === "undefined") return updatedAt;

  const payload: LocalPublishDraft = {
    ...draft,
    updatedAt,
  };
  localStorage.setItem(getLocalDraftKey(username), JSON.stringify(payload));
  return updatedAt;
}

function clearLocalDraft(username?: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getLocalDraftKey(username));
}

function formatDraftTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleString("zh-CN", { hour12: false });
}

type ViewMode = "edit" | "split" | "preview";

export default function PublishPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedDraftUserRef = useRef<string | null>(null);
  const initialDraft = useMemo(() => readImportedDraft(), []);

  // 带 slug 参数时进入编辑模式，否则为新建模式。
  const editSlug = searchParams.get("slug");
  const isEditing = Boolean(editSlug);

  const [title, setTitle] = useState(initialDraft.title);
  const [tags, setTags] = useState(initialDraft.tags);
  const [content, setContent] = useState(initialDraft.content);
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [status, setStatus] = useState(initialDraft.imported ? "已从 AI 创作代理导入草稿。" : "");
  const [uploading, setUploading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [draftUpdatedAt, setDraftUpdatedAt] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);

  const { categories } = useCategories();
  const { publishPost, publishing } = usePublishPost();

  const currentDraftUser = user?.username;

  useEffect(() => {
    if (!editSlug || !isAuthenticated) return;

    const loadPost = async () => {
      setLoadingPost(true);
      try {
        const res = await fetch(`/api/v1/blog/${editSlug}`);
        const data = await res.json();
        if (data.success && data.data) {
          const post = data.data;
          setTitle(post.title || "");
          setContent(post.content || "");
          setTags(post.tags || "");
          setCategoryId(post.category_id?.toString() || "");
          setExcerpt(post.excerpt || "");
          setCoverImageUrl(post.cover_image_url || "");
          setStatus("已加载文章内容。");
        } else {
          setStatus("文章不存在或无权编辑。");
        }
      } catch {
        setStatus("加载文章失败。");
      } finally {
        setLoadingPost(false);
      }
    };

    void loadPost();
  }, [editSlug, isAuthenticated]);

  const { textareaRef, stats, handleAction, handleKeyDown } = useMarkdownEditor({
    content,
    onChange: setContent,
    onSave: () => handleSaveDraft(),
    onPublish: () => publish(),
  });

  const { html: previewHtml } = useMarkdownPreview({ content });

  useEffect(() => {
    if (!initialDraft.imported || typeof window === "undefined") return;
    localStorage.removeItem(AGENT_DRAFT_KEY);
  }, [initialDraft.imported]);

  useEffect(() => {
    // 编辑模式只读远端文章，不混入本地草稿，避免覆盖线上内容。
    if (isEditing) return;

    const userKey = (currentDraftUser || "anon").toLowerCase();
    if (loadedDraftUserRef.current === userKey) return;
    loadedDraftUserRef.current = userKey;

    const draft = readLocalDraft(currentDraftUser);
    if (!draft) return;

    setDraftUpdatedAt(draft.updatedAt);

    setTitle((prev) => (prev.trim() ? prev : draft.title));
    setTags((prev) => (prev.trim() ? prev : draft.tags));
    setContent((prev) => (prev.trim() ? prev : draft.content));
    setCategoryId((prev) => (prev ? prev : draft.categoryId));
    setExcerpt((prev) => (prev.trim() ? prev : draft.excerpt));
    setCoverImageUrl((prev) => (prev ? prev : draft.coverImageUrl));

    if (!initialDraft.imported) {
      setStatus(`已恢复本地草稿（${formatDraftTime(draft.updatedAt)}）。`);
    }
  }, [currentDraftUser, initialDraft.imported, isEditing]);

  useEffect(() => {
    if (isEditing) return;

    const hasValue = Boolean(title.trim() || tags.trim() || content.trim() || categoryId);
    if (!hasValue) return;

    const timer = window.setTimeout(() => {
      const updatedAt = saveLocalDraft(currentDraftUser, {
        title,
        tags,
        content,
        categoryId,
        excerpt,
        coverImageUrl,
      });
      setDraftUpdatedAt(updatedAt);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [title, tags, content, categoryId, excerpt, coverImageUrl, currentDraftUser, isEditing]);

  function handleSaveDraft() {
    if (isEditing) {
      setStatus("编辑模式下不保存本地草稿。");
      return;
    }

    const hasValue = Boolean(title.trim() || tags.trim() || content.trim() || categoryId);
    if (!hasValue) {
      setStatus("草稿内容为空，无需保存。");
      return;
    }

    const updatedAt = saveLocalDraft(currentDraftUser, {
      title,
      tags,
      content,
      categoryId,
      excerpt,
      coverImageUrl,
    });
    setDraftUpdatedAt(updatedAt);
    setStatus(`草稿已保存（${formatDraftTime(updatedAt)}）。`);
  }

  function handleClearDraft() {
    if (isEditing) return;
    clearLocalDraft(currentDraftUser);
    setDraftUpdatedAt("");
    setStatus("本地草稿已清空。");
  }

  // 新建成功会清空草稿；更新成功则保留表单并跳转详情页。
  async function publish() {
    setStatus("");
    if (!title.trim() || !content.trim()) {
      setStatus("标题和内容不能为空。");
      return;
    }

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    try {
      const result = await publishPost({
        title,
        content,
        tags,
        categoryId,
        excerpt,
        coverImageUrl,
        slug: editSlug || undefined,
      });

      if (!result.ok) {
        setStatus(result.message);
        return;
      }

      setStatus(result.message);

      if (!isEditing) {
        setTitle("");
        setTags("");
        setContent("");
        setCategoryId("");
        setExcerpt("");
        setCoverImageUrl("");
        clearLocalDraft(currentDraftUser);
        setDraftUpdatedAt("");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("blog-updated"));
      }

      if (result.slug) {
        setTimeout(() => {
          router.push(`/post/${result.slug}`);
        }, 500);
      }
    } catch {
      setStatus(isEditing ? "更新失败。" : "发布失败。");
    }
  }

  // 上传成功后把 Markdown 图片标记插入到当前光标位置，保持写作流连续。
  async function uploadImage(file: File) {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setUploading(true);
    try {
      const resized = await resizeImageFile(file, 1600);
      const formData = new FormData();
      formData.append("file", resized);
      const imageUrl = await uploadImageRequest({
        formData,
        source: "blog.upload-image",
        context: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      });

      const markup = `![](${imageUrl})`;
      const textarea = textareaRef.current;
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "图片上传失败。");
    } finally {
      setUploading(false);
    }
  }

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onToolbarAction = useCallback(
    (action: ToolbarAction) => {
      if (action.type === "handler") {
        handleImageUpload();
      } else {
        handleAction(action);
      }
    },
    [handleAction, handleImageUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        void uploadImage(file);
      }
    },
    [uploadImage]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void uploadImage(file);
          break;
        }
      }
    },
    [uploadImage]
  );

  const pageTitle = isEditing ? "编辑文章" : "发布新文章";
  const pageDesc = isEditing ? "修改文章内容后点击更新。" : "写下你的想法与实践记录。";
  const submitLabel = isEditing ? "更新文章" : "发布文章";
  const submittingLabel = isEditing ? "更新中..." : "发布中...";

  return (
    <div className="container blog-page-shell publish-shell">
      <div className="card blog-page-card">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadImage(file);
            e.target.value = "";
          }}
        />
        {!isAuthenticated ? (
          <div className="py-20 text-center">
            <h3 className="text-xl font-bold mb-4">需要登录</h3>
            <p className="text-muted mb-6">登录后可撰写并发布文章。</p>
            <Link href="/login" className="btn-primary inline-flex">前往登录</Link>
          </div>
        ) : loadingPost ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-zinc-400">加载中...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 items-stretch bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden mt-6 mb-12 shadow-xl shadow-black/20">
            <div className="flex flex-col min-w-0 p-6 lg:p-8">
              <textarea
                className="publish-seamless-title"
                rows={title.length > 30 ? 2 : 1}
                value={title}
                onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
                placeholder="文章标题..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    textareaRef.current?.focus();
                  }
                }}
              />

              <div className="flex flex-wrap items-center justify-start gap-6 mt-auto mb-2 pt-2 px-2 border-b border-zinc-800/50 pb-2">
                <div className="flex items-center gap-1">
                  {[
                    { mode: "edit" as const, label: "写作" },
                    { mode: "split" as const, label: "分屏" },
                    { mode: "preview" as const, label: "预览" },
                  ].map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        "px-3 py-1 text-sm font-medium rounded-lg transition-all duration-200",
                        viewMode === mode
                          ? "bg-zinc-800 text-zinc-100 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {viewMode !== "preview" && (
                  <MarkdownToolbar
                    onAction={onToolbarAction}
                    onImageUpload={handleImageUpload}
                    disabled={uploading}
                    className="border-none bg-transparent p-0"
                  />
                )}
              </div>

              <div
                className={cn(
                  "editor-container transition-colors min-h-[500px] flex flex-col",
                  isDragging && "rounded-xl border-2 border-dashed border-blue-500 bg-blue-500/5"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div
                  className={cn(
                    "flex-1",
                    viewMode === "split" ? "grid grid-cols-1 lg:grid-cols-2 gap-px" : "block"
                  )}
                >
                  {viewMode !== "preview" && (
                    <div className="editor-pane flex flex-col h-full relative">
                      <textarea
                        ref={textareaRef}
                        className={cn(
                          "flex-1 p-2 lg:pr-8",
                          "bg-transparent border-none",
                          "text-zinc-200 placeholder-zinc-700/80",
                          "focus:outline-none focus:ring-0",
                          "font-mono text-[15px] leading-relaxed resize-y"
                        )}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="在此写下你的想法... &#10;&#10;支持 Markdown，快捷键：Ctrl+B 加粗，Ctrl+I 斜体&#10;拖拽或粘贴图片可直接上传"
                      />
                      <EditorStatusBar
                        stats={stats}
                        savedAt={isEditing ? undefined : draftUpdatedAt}
                        className="mt-6 pt-4 border-t border-zinc-800/30 text-[13px] text-zinc-500"
                      />
                    </div>
                  )}

                  {viewMode !== "edit" && (
                    <div
                      className={cn(
                        "preview-pane p-6 overflow-y-auto bg-zinc-950/20",
                        viewMode === "split" && "border-l border-zinc-800/50",
                        "prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-900/80",
                        viewMode === "preview" ? "block" : "hidden lg:block",
                        !content.trim() && "flex items-center justify-center flex-col"
                      )}
                    >
                      {content.trim() ? (
                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      ) : (
                        <div className="text-zinc-500 flex flex-col items-center gap-2 mt-20">
                          <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
                          </svg>
                          <p>在此预览 Markdown 渲染效果...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="publish-sidebar-panel flex flex-col gap-6 p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950/40">
              <div>
                <span className="text-sm font-bold text-zinc-300 block mb-3">文章封面</span>
                <CoverImageUploader
                  value={coverImageUrl}
                  onChange={setCoverImageUrl}
                  disabled={uploading}
                />
              </div>

              <div>
                <span className="text-sm font-bold text-zinc-300 block mb-2">分类专栏</span>
                <select
                  className="input w-full bg-zinc-900/80 border-zinc-800 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-sm font-bold text-zinc-300 block mb-2">标签</span>
                <input
                  className="input w-full bg-zinc-900/80 border-zinc-800 text-sm"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="如: AI, 随笔, 教程"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-zinc-300">摘要 (SEO)</span>
                  <span className={cn(
                    "text-xs",
                    excerpt.length > 160 ? "text-red-400" : "text-zinc-500"
                  )}>{excerpt.length}/160</span>
                </div>
                <textarea
                  className="input w-full bg-zinc-900/80 border-zinc-800 text-sm resize-none"
                  rows={4}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value.slice(0, 160))}
                  placeholder="用于搜索结果和卡片分享。留空则自动截取正文。"
                />
              </div>

              <div className="pt-4 border-t border-zinc-800/50 flex flex-col gap-3 mt-2">
                {status && (
                  <div className="text-accent text-xs text-center px-2 py-1 bg-blue-500/10 rounded-md">
                    {status}
                  </div>
                )}

                <button
                  className="btn-primary w-full shadow-lg shadow-blue-500/20 py-2.5 text-base font-semibold"
                  type="button"
                  onClick={publish}
                  disabled={publishing || !isAuthenticated}
                >
                  {publishing ? submittingLabel : submitLabel}
                </button>

                {!isEditing && isAuthenticated && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      className="btn-ghost text-sm w-full bg-zinc-900/50 hover:bg-zinc-800"
                      type="button"
                      onClick={handleSaveDraft}
                    >
                      保存草稿
                    </button>
                    <button
                      className="btn-ghost text-sm w-full bg-zinc-900/50 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                      type="button"
                      onClick={handleClearDraft}
                    >
                      清空
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
