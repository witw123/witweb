import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { marked } from "marked";
import { resizeImageFile } from "../utils/image";

export default function AdminEditor() {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const [imageSizePercent, setImageSizePercent] = useState(100);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const navigate = useNavigate();
  const contentRef = useRef(null);
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "");
    } catch {
      return null;
    }
  })();

  const preview = useMemo(() => {
    const renderer = new marked.Renderer();
    renderer.image = (href, title, text) => {
      const safeTitle = title ? ` title="${title}"` : "";
      const alt = text || "";
      return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} style="max-width: 100%; height: auto;" />`;
    };
    return marked.parse(content || "", { renderer });
  }, [content]);

  async function publish() {
    setStatus("");
    if (!title.trim() || !content.trim()) {
      setStatus("标题和内容不能为空。");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const res = await fetch("/api/admin/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content, tags }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.detail || "Failed to publish.");
      return;
    }
    setStatus("Published.");
    setTitle("");
    setTags("");
    setContent("");
  }

  function buildImageMarkup(url) {
    if (!imageWidth.trim()) {
      return `![](${url})`;
    }
    const widthValue = imageWidth.trim();
    return `<img src="${url}" style="max-width: 100%; width: ${widthValue};" />`;
  }

  function handleImageSelect(file) {
    if (!file) return;
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingPreviewUrl(preview);
    setShowSizeModal(true);
  }

  async function uploadImage(file) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
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

  function insertImageMarkup(url, widthValue) {
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

  return (
    <div className="admin-page">

      <div className="grid">
        <div className="card form">
          <label>
            标题
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="文章标题"
            />
          </label>
          <label>
            标签
            <input
              className="input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="例如：动画, 角色, 经验"
            />
          </label>
          <label>
            <div className="flex justify-between items-center mb-2">
              <span>内容</span>
              <label className="btn-ghost btn-sm cursor-pointer" style={{ margin: 0 }}>
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
            <textarea
              className="input"
              rows={12}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              ref={contentRef}
              placeholder="使用 Markdown 写作..."
            />
          </label>
          {showSizeModal && pendingImageFile && (
            <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.8)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
                <h3 className="text-lg font-bold mb-4">调整图片大小</h3>
                <div className="mb-4 bg-black/20 p-2 rounded flex justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <img
                    src={pendingPreviewUrl}
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
                  placeholder="或输入宽度，如 360px / 60%"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      if (pendingPreviewUrl) {
                        URL.revokeObjectURL(pendingPreviewUrl);
                      }
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
                      const widthValue = imageWidth.trim()
                        ? imageWidth.trim()
                        : `${imageSizePercent}%`;
                      const url = await uploadImage(pendingImageFile);
                      if (url) {
                        insertImageMarkup(url, widthValue);
                      }
                      if (pendingPreviewUrl) {
                        URL.revokeObjectURL(pendingPreviewUrl);
                      }
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
          {status && <p className="text-accent mb-2">{status}</p>}
          <button className="btn-primary w-full" type="button" onClick={publish}>
            发布
          </button>
        </div>
        <div className="card">
          <h2>实时预览</h2>
          <div
            className="markdown"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    </div>
  );
}
