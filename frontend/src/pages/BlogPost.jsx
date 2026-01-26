import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { marked } from "marked";

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [commentPage, setCommentPage] = useState(1);
  const commentsPerPage = 5;
  const [expandedReplies, setExpandedReplies] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageSizePercent, setImageSizePercent] = useState(100);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const editPreviewRef = useRef(null);
  const imageReplaceInputRef = useRef(null);
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "");
    } catch {
      return null;
    }
  })();
  const canEdit = profile?.username && post?.author && profile.username === post.author;

  function slugify(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function loadPost() {
    const token = localStorage.getItem("token");
    fetch(`/api/blog/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        setPost(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  function loadComments() {
    fetch(`/api/blog/${slug}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments(Array.isArray(data) ? data : []);
      })
      .catch(() => setComments([]));
  }

  useEffect(() => {
    setStatus("loading");
    loadPost();
    loadComments();
  }, [slug]);

  useEffect(() => {
    if (post) {
      setEditTitle(post.title || "");
      setEditContent(post.content || "");
      setEditTags(post.tags || "");
    }
  }, [post]);

  async function handleLike() {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    const res = await fetch(`/api/blog/${slug}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return;
    }
    await res.json().catch(() => ({}));
    loadPost();
  }

  async function handleComment(event) {
    event.preventDefault();
    setCommentStatus("");
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentStatus("请输入评论内容。");
      return;
    }
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/blog/${slug}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    loadComments();
    loadPost();
  }

  async function handleSaveEdit() {
    setEditStatus("");
    if (!editTitle.trim() || !editContent.trim()) {
      setEditStatus("Title and content required.");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      setEditStatus("Login required.");
      return;
    }
    const res = await fetch(`/api/blog/${slug}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: editTitle,
        content: editContent,
        tags: editTags,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditStatus(data.detail || "Save failed.");
      return;
    }
    setIsEditing(false);
    loadPost();
  }

  function buildImageMarkup(url) {
    if (!imageWidth.trim()) {
      return `![](${url})`;
    }
    const widthValue = imageWidth.trim();
    return `<img src="${url}" style="max-width: 100%; width: ${widthValue};" />`;
  }

  function handleImageSelect(file, replaceSrc = null) {
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

  async function uploadImage(file) {
    const token = localStorage.getItem("token");
    if (!token) {
      setEditStatus("Login required.");
      return null;
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      setEditStatus("Upload failed.");
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

  function getImageWidthFromContent(src) {
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

  function applyImageSize(widthValue) {
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

  function replaceImageSrc(oldSrc, newSrc, widthValue) {
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
    .map((tag) => tag.trim())
    .filter(Boolean);

  const { html: markdownHtml, toc: tocItems } = useMemo(() => {
    const items = [];
    const slugCounts = new Map();
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
    const html = marked.parse(post?.content || "", { renderer });
    return { html, toc: items };
  }, [post?.content]);

  const editPreviewHtml = useMemo(() => marked.parse(editContent || ""), [editContent]);

  function buildCommentTree(list) {
    const nodes = new Map();
    const roots = [];
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
    const sortByDate = (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const sortTree = (items) => {
      items.sort(sortByDate);
      items.forEach((child) => sortTree(child.children));
    };
    sortTree(roots);
    return roots;
  }

  const commentRoots = buildCommentTree(comments);
  const totalCommentPages = Math.max(
    1,
    Math.ceil(commentRoots.length / commentsPerPage),
  );
  const pagedRoots = commentRoots.slice(
    (commentPage - 1) * commentsPerPage,
    commentPage * commentsPerPage,
  );

  function handleReplyClick(comment) {
    const name = comment.author_name || comment.author || "访客";
    const prefix = `@${name} `;
    setReplyTo(comment);
    setCommentText((value) => (value.startsWith(prefix) ? value : prefix));
  }

  function renderComment(node, depth = 0) {
    const isReply = depth > 0;
    const isExpanded = !!expandedReplies[node.id];
    const replySlice = isExpanded ? node.children : node.children.slice(0, 5);
    return (
      <div
        key={node.id}
        id={`comment-${node.id}`}
        className={`comment-item${isReply ? " reply" : ""}`}
      >
        {node.author_avatar ? (
          <img src={node.author_avatar} alt={node.author_name} />
        ) : (
          <div className="avatar-fallback">{node.author_name?.[0] || "U"}</div>
        )}
        <div>
          <div className="comment-head">
            <strong>{node.author_name || node.author}</strong>
            <span className="comment-badge">Lv1</span>
          </div>
          {node.reply_to && (
            <div className="comment-reply-to">
              回复{" "}
              <a href={`#comment-${node.reply_to_id}`}>@{node.reply_to}</a>
            </div>
          )}
          <p className="comment-body">{node.content}</p>
          <div className="comment-meta">
            <span>{new Date(node.created_at).toLocaleString()}</span>
            <button
              className="comment-action"
              type="button"
              onClick={() => {
                const token = localStorage.getItem("token");
                if (!token) return;
                fetch(`/api/comment/${node.id}/like`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then(loadComments)
                  .catch(() => {});
              }}
            >
              赞 {node.like_count ?? 0}
            </button>
            <button
              className="comment-action"
              type="button"
              onClick={() => {
                const token = localStorage.getItem("token");
                if (!token) return;
                fetch(`/api/comment/${node.id}/dislike`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then(loadComments)
                  .catch(() => {});
              }}
            >
              踩 {node.dislike_count ?? 0}
            </button>
            <button
              className="comment-action"
              type="button"
              onClick={() => handleReplyClick(node)}
            >
              回复
            </button>
          </div>
          {depth === 0 && node.children.length > 0 && (
            <div className="comment-replies">
              {replySlice.map((child) => renderComment(child, depth + 1))}
              {node.children.length > 5 && (
                <button
                  className="button ghost small"
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
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>AI Studio</h1>
        </div>
      </header>
      <div className="post-toolbar">
        <div>
          {canEdit && (
            <button
              className="button ghost"
              type="button"
              onClick={() => setIsEditing((value) => !value)}
            >
              {isEditing ? "取消编辑" : "编辑"}
            </button>
          )}
        </div>
        <Link className="button ghost" to="/">
          返回讨论区
        </Link>
      </div>
      {post?.title && <h2 style={{ marginTop: 0 }}>{post.title}</h2>}
      {post && (
        <div className="meta meta-detail">
          <div className="meta-author">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name} />
            ) : (
              <div className="avatar-fallback">{post.author_name?.[0] || "U"}</div>
            )}
            <span>{post.author_name || post.author}</span>
          </div>
          <div className="meta-actions">
            <button className="comment-action" type="button" onClick={handleLike}>
              赞 {post.like_count ?? 0}
            </button>
            <button
              className="comment-action"
              type="button"
              onClick={() => {
                const token = localStorage.getItem("token");
                if (!token) {
                  navigate("/login");
                  return;
                }
                fetch(`/api/blog/${slug}/favorite`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((res) => res.json())
                  .then(() => loadPost())
                  .catch(() => {});
              }}
            >
              收藏 {post.favorite_count ?? 0}
            </button>
            <button
              className="comment-action"
              type="button"
              onClick={() => {
                const token = localStorage.getItem("token");
                if (!token) return;
                fetch(`/api/blog/${slug}/dislike`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((res) => res.json())
                  .then(() => loadPost())
                  .catch(() => {});
              }}
            >
              踩 {post.dislike_count ?? 0}
            </button>
            <span>💬 {post.comment_count ?? 0}</span>
          </div>
        </div>
      )}
      {tagList.length > 0 && (
        <div className="tag-list tag-list-detail">
          {tagList.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {status === "loading" && <p>加载中...</p>}
      {status === "error" && <p>加载失败，请稍后再试。</p>}
      {isEditing && (
        <section className="card form">
          <label>
            Title
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="Title"
            />
          </label>
          <label>
            Tags
            <input
              value={editTags}
              onChange={(event) => setEditTags(event.target.value)}
              placeholder="tag1, tag2"
            />
          </label>
          <label>
            Content
            <div className="comment-form-actions">
              <input
                className="image-width-input"
                value={imageWidth}
                onChange={(event) => setImageWidth(event.target.value)}
                placeholder="图片宽度，如 360px / 60%"
              />
              <label className="button ghost small" style={{ margin: 0 }}>
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
              rows={10}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              placeholder="Write content..."
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
          <div className="card image-editor">
            <div className="image-editor-title">
              点击预览里的图片进行替换
              {selectedImage && (
                <div className="comment-form-actions">
                  <button
                    className="button ghost small"
                    type="button"
                    onClick={() => imageReplaceInputRef.current?.click()}
                  >
                    更换图片
                  </button>
                  <button
                    className="button ghost small"
                    type="button"
                    onClick={removeSelectedImage}
                  >
                    删除图片
                  </button>
                </div>
              )}
            </div>
            <div
              ref={editPreviewRef}
              className="markdown markdown-preview"
              dangerouslySetInnerHTML={{ __html: editPreviewHtml }}
              onClick={(event) => {
                const target = event.target;
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
            <div className="image-modal">
              <div className="image-modal-card">
                <div className="image-modal-title">调整图片大小</div>
                <div className="image-modal-preview">
                  <img
                    src={pendingPreviewUrl || selectedImage}
                    alt="preview"
                    style={{
                      maxWidth: "100%",
                      width: imageWidth.trim()
                        ? imageWidth.trim()
                        : `${imageSizePercent}%`,
                    }}
                  />
                </div>
                <div className="image-modal-row">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={imageSizePercent}
                    onChange={(event) => setImageSizePercent(Number(event.target.value))}
                  />
                  <span>{imageSizePercent}%</span>
                </div>
                <input
                  className="image-width-input"
                  value={imageWidth}
                  onChange={(event) => setImageWidth(event.target.value)}
                  placeholder="或输入宽度，如 360px / 60%"
                />
                <div className="comment-form-actions">
                  {selectedImage && (
                    <>
                      <button
                        className="button ghost small"
                        type="button"
                        onClick={() => imageReplaceInputRef.current?.click()}
                      >
                        更换图片
                      </button>
                      <button
                        className="button ghost small"
                        type="button"
                        onClick={removeSelectedImage}
                      >
                        删除图片
                      </button>
                    </>
                  )}
                  <button
                    className="button primary small"
                    type="button"
                    onClick={async () => {
                      const widthValue = imageWidth.trim()
                        ? imageWidth.trim()
                        : `${imageSizePercent}%`;
                      if (pendingImageFile) {
                        const url = await uploadImage(pendingImageFile);
                        if (url) {
                          if (selectedImage) {
                            replaceImageSrc(selectedImage, url, widthValue);
                          } else {
                            const markup = widthValue
                              ? `<img src="${url}" style="max-width: 100%; width: ${widthValue};" />`
                              : `![](${url})`;
                            setEditContent((prev) => `${prev}\n\n${markup}\n`);
                          }
                        }
                      } else if (selectedImage) {
                        applyImageSize(widthValue);
                      }
                      if (pendingPreviewUrl) {
                        URL.revokeObjectURL(pendingPreviewUrl);
                      }
                      setPendingPreviewUrl("");
                      setPendingImageFile(null);
                      setShowSizeModal(false);
                    }}
                  >
                    应用
                  </button>
                  <button
                    className="button ghost small"
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
                    关闭
                  </button>
                </div>
              </div>
            </div>
          )}
          {editStatus && <p className="error">{editStatus}</p>}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button className="button primary" type="button" onClick={handleSaveEdit}>
              Save
            </button>
            <button className="button ghost" type="button" onClick={() => setIsEditing(false)}>
              Cancel
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
            <article
              className="markdown"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          </div>
          {post.created_at && (
            <div className="post-footer">
              <span className="muted">
                发布时间：{new Date(post.created_at).toLocaleString()}
              </span>
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
              placeholder={replyTo ? `回复 @${replyTo.author_name || replyTo.author}` : "写下你的观点..."}
            />
          </label>
          {commentStatus && <p className="status">{commentStatus}</p>}
          <div className="comment-form-actions">
            {replyTo && (
              <button
                className="button ghost small"
                type="button"
                onClick={() => setReplyTo(null)}
              >
                取消回复
              </button>
            )}
            <button className="button ghost small" type="submit">
              发布评论
            </button>
          </div>
        </form>

        <div className="comment-list">
          {commentRoots.length === 0 && <p className="muted">暂无评论。</p>}
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
