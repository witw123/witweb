import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getThumbnailUrl } from "../utils/url";
import { getFavoritesCache, setFavoritesCache } from "../utils/memoryStore";
import { getCachedJson, setCachedJson } from "../utils/cache";
import * as blogService from "../services/blogService";

export default function Favorites() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  const navigate = useNavigate();
  const profile = (() => {
    try {
      return JSON.parse(localStorage.getItem("profile") || "");
    } catch {
      return null;
    }
  })();
  const token = localStorage.getItem("token");
  const cacheUserKeys = [profile?.username, token, "anon"].filter(Boolean);
  const cacheKeySignature = cacheUserKeys.join("|");
  const localCacheKeys = cacheUserKeys.map((key) => `cache:favorites:${key}:${page}`);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    // Check cache first
    let cached = null;
    for (const key of cacheUserKeys) {
      cached = getFavoritesCache(`${key}:${page}`);
      if (cached) break;
    }
    if (!cached) {
      for (const key of localCacheKeys) {
        cached = getCachedJson(key);
        if (cached) break;
      }
    }
    if (cached) {
      setItems(Array.isArray(cached.items) ? cached.items : []);
      setTotal(cached.total || 0);
      setStatus("ready");
      return;
    }
    // Fetch from API
    setStatus("loading");
    blogService.getFavorites(page, pageSize)
      .then((data) => {
        const payload = {
          items: Array.isArray(data.items) ? data.items : [],
          total: data.total || 0,
        };
        setItems(payload.items);
        setTotal(payload.total);
        // Update cache
        cacheUserKeys.forEach((key) => {
          setFavoritesCache(`${key}:${page}`, payload);
        });
        localCacheKeys.forEach((key) => {
          setCachedJson(key, payload);
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [page, navigate, cacheKeySignature]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="favorites-page">
      <div className="header-actions flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">我的收藏</h1>
        </div>
        <div className="actions">
          <Link className="btn-ghost" to="/">
            返回讨论区
          </Link>
        </div>
      </div>
      {status === "loading" && <p>加载中...</p>}
      {status === "error" && <p>加载失败，请稍后再试。</p>}
      {status === "ready" && items.length === 0 && <p>暂无收藏。</p>}
      <div className="list grid">
        {items.map((post) => (
          <Link key={post.slug} to={`/ post / ${post.slug} `} className="card block no-underline text-inherit hover:border-accent transition-colors">
            <div className="card-head flex justify-between items-start mb-2">
              <div className="author flex items-center gap-2">
                {post.author_avatar ? (
                  <img src={getThumbnailUrl(post.author_avatar, 64)} alt={post.author} className="w-6 h-6 rounded-full" />
                ) : <div className="avatar-fallback w-6 h-6 text-xs">{post.author?.[0]}</div>}
                <span className="text-sm font-medium">{post.author}</span>
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">{post.title}</h2>
            <p className="text-muted text-sm mb-4 leading-relaxed line-clamp-2">
              {(post.content || "").replace(/\s+/g, " ").trim().slice(0, 140)}
            </p>
            <div className="flex justify-between items-center mt-auto">
              <div className="text-xs text-muted">
                {new Date(post.created_at).toLocaleString()}
              </div>
              <div className="flex gap-2 text-sm text-secondary">
                <span>👍 {post.like_count ?? 0}</span>
                <span>💬 {post.comment_count ?? 0}</span>
                <span>★ {post.favorite_count ?? 0}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination flex justify-center gap-4 mt-8 items-center">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </button>
          <span className="text-muted text-sm">
            第 {page} / {totalPages} 页
          </span>
          <button
            className="btn-ghost"
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
