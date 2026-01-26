import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Favorites() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    setStatus("loading");
    fetch(`/api/favorites?page=${page}&size=${pageSize}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [page, navigate]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>AI Studio</h1>
          <p className="muted">我的收藏</p>
        </div>
        <div className="actions">
          <Link className="button ghost" to="/">
            返回讨论区
          </Link>
        </div>
      </header>
      {status === "loading" && <p>加载中...</p>}
      {status === "error" && <p>加载失败，请稍后再试。</p>}
      {status === "ready" && items.length === 0 && <p>暂无收藏。</p>}
      <div className="list">
        {items.map((post) => (
          <Link key={post.slug} to={`/post/${post.slug}`} className="card">
            <div className="card-head">
              <div className="author">
                {post.author_avatar ? (
                  <img src={post.author_avatar} alt={post.author_name} />
                ) : (
                  <div className="avatar-fallback">{post.author_name?.[0] || "U"}</div>
                )}
                <span>{post.author_name || post.author || "匿名"}</span>
              </div>
            </div>
            <h2>{post.title}</h2>
            <p className="excerpt">
              {(post.content || "").replace(/\s+/g, " ").trim().slice(0, 140)}
            </p>
            <div className="post-card-footer">
              <div className="post-card-meta">
                <span className="muted">{new Date(post.created_at).toLocaleString()}</span>
              </div>
              <div className="post-card-actions">
                <span>赞 {post.like_count ?? 0}</span>
                <span>踩 {post.dislike_count ?? 0}</span>
                <span>评论 {post.comment_count ?? 0}</span>
                <span>收藏 {post.favorite_count ?? 0}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="button ghost"
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </button>
          <span className="muted">
            第 {page} / {totalPages} 页
          </span>
          <button
            className="button ghost"
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
