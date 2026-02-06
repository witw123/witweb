"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { resizeImageFile } from "@/utils/image";

export default function PublishPage() {
  const { isAuthenticated, token } = useAuth();
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((response) => {
        setCategories(Array.isArray(response.data?.items) ? response.data.items : []);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

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
    const imageUrl = payload?.data?.url || payload?.url;
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
    <div className="container" style={{ paddingTop: "32px", paddingBottom: "32px" }}>
      <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
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
                placeholder="使用 Markdown 写作..."
              />
            </label>

            <div className="flex items-center gap-4 mt-1">
              <label className="btn-ghost">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                    e.currentTarget.value = "";
                  }}
                />
                {uploading ? "上传中..." : "上传图片"}
              </label>
            </div>

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
