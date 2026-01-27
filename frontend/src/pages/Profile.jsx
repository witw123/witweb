import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import * as authService from "../services/authService";
import * as blogService from "../services/blogService";
import { resizeImageToDataUrl } from "../utils/image";
import { getThumbnailUrl } from "../utils/url";
import "./Profile.css";

export default function Profile() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("info");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef(null);

  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [favoritesTotal, setFavoritesTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || "");
      setAvatarUrl(user.avatar_url || "");
      setPreviewAvatar(user.avatar_url || "");
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "favorites") {
      loadFavorites();
    }
  }, [activeTab, favoritesPage]);

  async function loadFavorites() {
    setFavoritesLoading(true);
    try {
      const data = await blogService.getFavorites(favoritesPage, pageSize);
      setFavorites(data.items || []);
      setFavoritesTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setFavoritesLoading(false);
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const resized = await resizeImageToDataUrl(file, 256);
    setAvatarUrl(resized || "");
    setPreviewAvatar(resized || "");
  }

  async function handleSave(event) {
    event.preventDefault();
    setStatus("saving");

    try {
      await authService.updateProfile({
        nickname,
        avatar_url: avatarUrl,
      });
      setStatus("success");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(favoritesTotal / pageSize));

  return (
    <div className="profile-page">
      <div className="profile-shell">
        <header className="profile-hero">
          <div className="profile-hero-content">
            <div className="profile-identity">
              <div
                className="profile-avatar"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") fileInputRef.current?.click();
                }}
              >
                {(previewAvatar || user?.avatar_url) ? (
                  <img
                    src={previewAvatar || getThumbnailUrl(user.avatar_url, 256)}
                    alt="Avatar"
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <label className="profile-avatar-mask">
                  更换头像
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
              <div className="profile-identity-text">
                <span className="profile-eyebrow">个人中心</span>
                <h1 className="profile-title">{user?.username || "--"}</h1>
                <p className="profile-subtitle">管理您的个人信息和内容</p>
                <div className="profile-badges">
                  <span className="profile-badge">{user?.role || "Member"}</span>
                  <span className="profile-badge ghost">Joined {new Date().getFullYear()}</span>
                </div>
              </div>
            </div>
            <div className="profile-meta">
              <div className="profile-meta-card">
                <span className="profile-meta-label">昵称</span>
                <strong className="profile-meta-value">{nickname || user?.username || "--"}</strong>
              </div>
              <div className="profile-meta-card">
                <span className="profile-meta-label">账号 ID</span>
                <strong className="profile-meta-value">{user?.username || "--"}</strong>
              </div>
            </div>
          </div>
        </header>

        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === "info" ? "is-active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            基本信息
          </button>
          <button
            className={`profile-tab ${activeTab === "favorites" ? "is-active" : ""}`}
            onClick={() => setActiveTab("favorites")}
          >
            我的收藏
          </button>
        </div>

        <div className="profile-content">
          {activeTab === "info" && (
            <form className="profile-form" onSubmit={handleSave}>
              <div className="profile-form-grid">
                <section className="profile-card">
                  <h2 className="profile-card-title">账号资料</h2>
                  <label className="profile-field">
                    <span>昵称</span>
                    <input
                      className="input"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="设置一个好记的昵称"
                    />
                    <small className="profile-help">昵称将显示在站内评论中。</small>
                  </label>
                  <label className="profile-field">
                    <span>账号 ID</span>
                    <input
                      className="input profile-input-disabled"
                      value={user?.username || ""}
                      disabled
                    />
                  </label>
                </section>

                <section className="profile-card profile-card--accent">
                  <h2 className="profile-card-title">你的形象</h2>
                  <p className="profile-card-subtitle">
                    头像与昵称是你在站内的样子，让身份更一眼可识。
                  </p>
                  <div className="profile-preview">
                    <div className="profile-preview-avatar">
                      {(previewAvatar || user?.avatar_url) ? (
                        <img
                          src={previewAvatar || getThumbnailUrl(user.avatar_url, 256)}
                          alt="Avatar"
                        />
                      ) : (
                        <div className="profile-avatar-fallback">
                          {user?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="profile-preview-name">{nickname || user?.username || "--"}</div>
                      <div className="profile-preview-id">@{user?.username || "--"}</div>
                    </div>
                  </div>
                  <div className="profile-status">
                    {status === "success" && <p className="status success">保存成功</p>}
                    {status === "error" && <p className="status error">保存失败，请重试。</p>}
                    {status === "saving" && <p className="status muted">正在保存...</p>}
                    {status === "" && <span />}
                  </div>
                  <button className="btn-primary profile-save" type="submit" disabled={status === "saving"}>
                    保存修改
                  </button>
                </section>
              </div>
            </form>
          )}

          {activeTab === "favorites" && (
            <div className="profile-favorites">
              {favoritesLoading && <p className="profile-empty">加载中...</p>}
              {!favoritesLoading && favorites.length === 0 && (
                <p className="profile-empty">暂无收藏</p>
              )}
              <div className="profile-fav-grid">
                {favorites.map((post) => (
                  <Link
                    key={post.slug}
                    to={`/post/${post.slug}`}
                    className="profile-fav-card"
                  >
                    <div className="profile-fav-head">
                      <div className="profile-fav-author">
                        {post.author_avatar ? (
                          <img src={getThumbnailUrl(post.author_avatar, 64)} alt={post.author} />
                        ) : (
                          <div className="profile-fav-fallback">{post.author?.[0]}</div>
                        )}
                        <span>{post.author}</span>
                      </div>
                      <span className="profile-fav-date">{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>
                      {(post.content || "").replace(/\s+/g, " ").trim().slice(0, 140)}
                    </p>
                    <div className="profile-fav-meta">
                      <span>👍 {post.like_count ?? 0}</span>
                      <span>💬 {post.comment_count ?? 0}</span>
                      <span>★ {post.favorite_count ?? 0}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="profile-pagination">
                  <button
                    className="btn-ghost"
                    onClick={() => setFavoritesPage((p) => Math.max(1, p - 1))}
                    disabled={favoritesPage === 1}
                  >
                    上一页
                  </button>
                  <span>
                    第 {favoritesPage} / {totalPages} 页
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => setFavoritesPage((p) => Math.min(totalPages, p + 1))}
                    disabled={favoritesPage === totalPages}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
