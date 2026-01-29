"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers";
import { resizeImageToDataUrl } from "@/utils/image";
import { getThumbnailUrl } from "@/utils/url";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [status, setStatus] = useState<"" | "saving" | "success" | "error">("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || "");
      setAvatarUrl(user.avatar_url || "");
      setPreviewAvatar(user.avatar_url || "");
    }
  }, [user]);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const resized = await resizeImageToDataUrl(file, 256);
    setAvatarUrl(resized || "");
    setPreviewAvatar(resized || "");
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setStatus("error");
        return;
      }
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nickname,
          avatar_url: avatarUrl,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      if (data.profile) {
        updateProfile(data.profile);
      }
      setStatus("success");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-shell">
        <header className="profile-hero">
          <div className="profile-hero-content">
            <div className="profile-identity">
              <div className="profile-avatar">
                {(previewAvatar || user?.avatar_url) ? (
                  <img
                    src={previewAvatar || (user?.avatar_url?.startsWith("data:") ? user.avatar_url : getThumbnailUrl(user?.avatar_url, 256))}
                    alt="Avatar"
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    {user?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <label className="profile-avatar-mask" style={{ cursor: "pointer" }}>
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
                <h1 className="profile-title">{user?.username || "--"}</h1>
                <p className="profile-subtitle">管理您的个人信息</p>
              </div>
            </div>
          </div>
        </header>

        <div className="profile-content">
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
                        src={previewAvatar || (user?.avatar_url?.startsWith("data:") ? user.avatar_url : getThumbnailUrl(user?.avatar_url, 256))}
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
        </div>
      </div>
    </div>
  );
}
