import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { marked } from "marked";

export default function AdminEditor() {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "");
    } catch {
      return null;
    }
  })();

  const preview = useMemo(() => marked.parse(content || ""), [content]);

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

  function logout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>AI Studio</h1>
          <p className="muted">工作区 · 讨论区管理</p>
        </div>
        <div className="actions">
          <Link className="button ghost" to="/">
            返回讨论区
          </Link>
          {profile ? (
            <div className="user-chip">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.nickname} />
              ) : (
                <div className="avatar-fallback">{profile.nickname?.[0] || "U"}</div>
              )}
              <span>{profile.nickname || profile.username}</span>
            </div>
          ) : null}
          <button className="button ghost" onClick={logout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="grid">
        <div className="card form">
          <label>
            标题
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="文章标题"
            />
          </label>
          <label>
            标签
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="例如：动画, 角色, 经验"
            />
          </label>
          <label>
            Markdown 内容
            <textarea
              rows={12}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="使用 Markdown 写作..."
            />
          </label>
          {status && <p className="status">{status}</p>}
          <button className="button primary" type="button" onClick={publish}>
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
