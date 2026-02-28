"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { resizeImageFile } from "@/utils/image";
import type { SuccessResponse } from "@/lib/api-response";
import type { Category } from "@/types/blog";

const AGENT_DRAFT_KEY = "agent_publish_draft_v1";
const LOCAL_DRAFT_KEY_PREFIX = "publish_local_draft_v1";

type LocalPublishDraft = {
  title: string;
  tags: string;
  content: string;
  categoryId: string;
  updatedAt: string;
};

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

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

function getLocalDraftKey(username?: string): string {
  const suffix = username?.trim() ? username.trim().toLowerCase() : "guest";
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

export default function PublishPage() {
  const { isAuthenticated, token, user } = useAuth();
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedDraftUserRef = useRef<string | null>(null);
  const initialDraft = useMemo(() => readImportedDraft(), []);
  const [title, setTitle] = useState(initialDraft.title);
  const [tags, setTags] = useState(initialDraft.tags);
  const [content, setContent] = useState(initialDraft.content);
  const [status, setStatus] = useState(initialDraft.imported ? "已从 AI 创作代理导入草稿。" : "");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [draftUpdatedAt, setDraftUpdatedAt] = useState("");

  const currentDraftUser = user?.username;

  useEffect(() => {
    if (!initialDraft.imported || typeof window === "undefined") return;
    localStorage.removeItem(AGENT_DRAFT_KEY);
  }, [initialDraft.imported]);

  useEffect(() => {
    const userKey = (currentDraftUser || "guest").toLowerCase();
    if (loadedDraftUserRef.current === userKey) return;
    loadedDraftUserRef.current = userKey;

    const draft = readLocalDraft(currentDraftUser);
    if (!draft) return;

    setDraftUpdatedAt(draft.updatedAt);

    // 优先保留页面已有内容（如来自 Agent），仅补齐空字段。
    setTitle((prev) => (prev.trim() ? prev : draft.title));
    setTags((prev) => (prev.trim() ? prev : draft.tags));
    setContent((prev) => (prev.trim() ? prev : draft.content));
    setCategoryId((prev) => (prev ? prev : draft.categoryId));

    if (!initialDraft.imported) {
      setStatus(`已恢复本地草稿（${formatDraftTime(draft.updatedAt)}）。`);
    }
  }, [currentDraftUser, initialDraft.imported]);

  useEffect(() => {
    const hasValue = Boolean(title.trim() || tags.trim() || content.trim() || categoryId);
    if (!hasValue) return;

    const timer = window.setTimeout(() => {
      const updatedAt = saveLocalDraft(currentDraftUser, { title, tags, content, categoryId });
      setDraftUpdatedAt(updatedAt);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [title, tags, content, categoryId, currentDraftUser]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((response) => {
        const data = readSuccessData<{ items: Category[] }>(response);
        setCategories(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  function handleSaveDraft() {
    const hasValue = Boolean(title.trim() || tags.trim() || content.trim() || categoryId);
    if (!hasValue) {
      setStatus("草稿内容为空，无需保存。");
      return;
    }

    const updatedAt = saveLocalDraft(currentDraftUser, { title, tags, content, categoryId });
    setDraftUpdatedAt(updatedAt);
    setStatus(`草稿已保存（${formatDraftTime(updatedAt)}）。`);
  }

  function handleClearDraft() {
    clearLocalDraft(currentDraftUser);
    setDraftUpdatedAt("");
    setStatus("本地草稿已清空。");
  }

  async function publish() {
    setStatus("");
    if (!title.trim() || !content.trim()) {
      setStatus("标题和内容不能为空。");
      return;
    }

    if (!token) {
      router.push("/login");
      return;
    }

    setPublishing(true);
    const res = await fetch("/api/blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        content,
        tags,
        category_id: categoryId ? Number(categoryId) : null,
      }),
    });
    setPublishing(false);

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.success) {
      setStatus(payload?.error?.message || "发布失败。");
      return;
    }

    setStatus("已发布。");
    setTitle("");
    setTags("");
    setContent("");
    setCategoryId("");
    clearLocalDraft(currentDraftUser);
    setDraftUpdatedAt("");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("blog-updated"));
    }
  }

  async function uploadImage(file: File) {
    if (!token) {
      router.push("/login");
      return;
    }

    setUploading(true);
    const resized = await resizeImageFile(file, 1600);
    const formData = new FormData();
    formData.append("file", resized);

    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    setUploading(false);

    const payload = await res.json().catch(() => ({}));
    const data = readSuccessData<{ url: string }>(payload);
    const imageUrl = data?.url;
    if (!res.ok || !imageUrl) {
      setStatus(payload?.error?.message || "图片上传失败。");
      return;
    }

    const markup = `![](${imageUrl})`;
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

  return (
    <div className="container blog-page-shell publish-shell">
      <div className="card blog-page-card">
        <div className="card-head">
          <div>
            <h2 className="text-2xl font-bold">发布新文章</h2>
            <p className="text-muted text-sm mt-1">写下你的想法与实践记录。</p>
          </div>
          {!isAuthenticated && (
            <Link href="/login" className="btn-primary">登录</Link>
          )}
        </div>

        {!isAuthenticated ? (
          <p className="text-muted">登录后可发布文章。</p>
        ) : (
          <div className="form">
            <label>
              <span className="text-sm text-muted">标题</span>
              <input
                className="input mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文章标题"
              />
            </label>

            <label>
              <span className="text-sm text-muted">分类</span>
              <select
                className="input mt-1"
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
            </label>

            <label>
              <span className="text-sm text-muted">标签</span>
              <input
                className="input mt-1"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如：AI, 工程, 系统"
              />
            </label>

            <label>
              <span className="text-sm text-muted">内容</span>
              <textarea
                ref={contentRef}
                className="mt-1"
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="支持 Markdown；普通文本也会保留换行和段落格式。"
              />
            </label>

            <div className="publish-actions-row mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                  e.currentTarget.value = "";
                }}
              />
              <button
                className="btn-ghost publish-action-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "上传中..." : "上传图片"}
              </button>

              <div className="publish-actions-right">
                <button className="btn-ghost publish-action-btn" type="button" onClick={handleClearDraft}>
                  清空草稿
                </button>
                <button className="btn-ghost publish-action-btn" type="button" onClick={handleSaveDraft}>
                  保存草稿
                </button>
              </div>
            </div>

            <p className="text-muted text-xs mt-1">
              草稿会自动保存在当前浏览器
              {draftUpdatedAt ? `，上次保存：${formatDraftTime(draftUpdatedAt)}` : ""}。
            </p>

            {status && <p className="text-accent text-sm mt-2">{status}</p>}

            <button className="btn-primary w-full mt-4" type="button" onClick={publish} disabled={publishing}>
              {publishing ? "发布中..." : "发布文章"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
