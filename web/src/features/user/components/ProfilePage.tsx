"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resizeImageFile, resizeImageToDataUrl } from "@/utils/image";
import { getThumbnailUrl } from "@/utils/url";
import { clearAllCaches } from "@/utils/memoryStore";
import PostCard from "@/components/PostCard";

type PostItem = {
  title: string;
  slug: string;
  content?: string;
  created_at?: string;
  tags?: string;
  like_count?: number;
  comment_count?: number;
  favorite_count?: number;
  author?: string;
  author_name?: string;
  author_avatar?: string;
  favorited_by_me?: boolean;
};

type ActivityItem = {
  type: 'post' | 'like' | 'comment';
  title: string;
  slug: string;
  created_at: string;
  content?: string;
  target_user?: string;
  id?: string;
};

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function buildExcerpt(content?: string) {
  if (!content) return "";
  return content
    .replace(/[#>*`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export default function ProfilePage({ targetUsername }: { targetUsername?: string }) {
  const { user: authUser, updateProfile, token } = useAuth();
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const isOwnProfile = !targetUsername || targetUsername === authUser?.username;
  const username = targetUsername || authUser?.username || "";

  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<"" | "saving" | "success" | "error">("");
  const [activeTab, setActiveTab] = useState<"posts" | "activity" | "favorites">("posts");

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [favorites, setFavorites] = useState<PostItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 5;
  const totalPages = Math.ceil(totalCount / pageSize);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");

  useEffect(() => {
    if (initialTab === "activity" || initialTab === "favorites" || initialTab === "posts") {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Determine which profile data to use
  const activeProfile = isOwnProfile ? authUser : targetProfile;

  const avatarBase = isOwnProfile ? (previewAvatar || authUser?.avatar_url || "") : (targetProfile?.avatar_url || "");
  const avatarSrc = avatarBase
    ? (avatarBase.startsWith("data:") ? avatarBase : getThumbnailUrl(avatarBase, 256))
    : "";

  const coverBase = isOwnProfile ? (coverPreview || authUser?.cover_url || "") : (targetProfile?.cover_url || "");
  const coverSrc = coverBase
    ? (coverBase.startsWith("data:") ? coverBase : getThumbnailUrl(coverBase, 1600))
    : "";

  // Initial load or username change
  useEffect(() => {
    if (isOwnProfile && authUser) {
      setNickname(authUser.nickname || authUser.username || "");
      setAvatarUrl(authUser.avatar_url || "");
      setPreviewAvatar(authUser.avatar_url || "");
      setCoverUrl(authUser.cover_url || "");
      setCoverPreview(authUser.cover_url || "");
      setBio((authUser as any)?.bio || "");
    } else if (!isOwnProfile && username) {
      fetchProfile();
    }
  }, [username, authUser, isOwnProfile]);

  const fetchProfile = async () => {
    if (!username) return;
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setTargetProfile(data);
      setNickname(data.nickname || data.username || "");
      setBio(data.bio || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const resized = await resizeImageToDataUrl(file, 256);
    setAvatarUrl(resized || "");
    setPreviewAvatar(resized || "");
    setTimeout(() => handleSave(undefined, true), 0);
  }

  async function uploadCover(file: File) {
    if (!token) throw new Error("missing_token");
    const resized = await resizeImageFile(file, 1600);
    const form = new FormData();
    form.append("file", resized, resized.name || "cover.jpg");
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) throw new Error("upload_failed");
    return data.url as string;
  }

  async function handleCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadCover(file);
      setCoverUrl(url);
      setCoverPreview(url);
      await handleSave(url);
    } catch {
      setStatus("error");
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleSave(nextCover?: string, silent: boolean = false) {
    if (!silent) setStatus("saving");
    try {
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
          cover_url: typeof nextCover === "string" ? nextCover : coverUrl,
          bio,
        }),
      });
      if (!res.ok) {
        if (!silent) setStatus("error");
        return;
      }
      const data = await res.json();
      if (data.profile) {
        updateProfile(data.profile);
      }
      clearAllCaches();
      try {
        const ts = Date.now().toString();
        localStorage.setItem("profile_updated_at", ts);
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...data.profile, updated_at: ts } }));
      } catch { }
      setStatus("success");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("error");
    }
  }

  const lastSavedBioRef = useRef<string>("");
  const bioSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNameRef = useRef<string>("");
  const nameSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOwnProfile || !username) return;
    if (bioSaveTimerRef.current) clearTimeout(bioSaveTimerRef.current);
    if (bio === lastSavedBioRef.current) return;
    bioSaveTimerRef.current = setTimeout(() => {
      lastSavedBioRef.current = bio;
      handleSave(undefined, true);
    }, 800);
  }, [bio, username, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile || !username) return;
    if (nameSaveTimerRef.current) clearTimeout(nameSaveTimerRef.current);
    if (nickname === lastSavedNameRef.current) return;
    nameSaveTimerRef.current = setTimeout(() => {
      lastSavedNameRef.current = nickname;
      handleSave(undefined, true);
    }, 800);
  }, [nickname, username, isOwnProfile]);

  const safeJson = async (res: Response) => {
    if (!res.ok) throw new Error("http_error");
    const text = await res.text();
    if (!text) return {} as any;
    try {
      return JSON.parse(text);
    } catch {
      return {} as any;
    }
  };

  const loadPosts = async (silent = false) => {
    if (!username) return [] as PostItem[];
    if (!silent) setTabLoading(true);
    try {
      const res = await fetch(`/api/blog?author=${encodeURIComponent(username)}&page=${page}&size=${pageSize}`);
      const data = await safeJson(res);
      const items = data.items || [];
      setPosts(items);
      setTotalCount(data.total || 0);
      return items as PostItem[];
    } catch {
      setPosts([]);
      setTotalCount(0);
      return [] as PostItem[];
    } finally {
      if (!silent) setTabLoading(false);
    }
  };

  const loadFavorites = async (silent = false) => {
    if (!silent) setTabLoading(true);
    try {
      const res = await fetch(`/api/favorites?page=${page}&size=${pageSize}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await safeJson(res);
      setFavorites(data.items || []);
      setTotalCount(data.total || 0);
    } catch {
      setFavorites([]);
      setTotalCount(0);
    } finally {
      if (!silent) setTabLoading(false);
    }
  };

  const loadActivity = async (silent = false) => {
    if (!username) return;
    if (!silent) setTabLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/activity?page=${page}&size=${pageSize}`);
      const data = await safeJson(res);
      const items = data.items || [];
      setActivity(items);
      setTotalCount(data.total || 0);
    } finally {
      if (!silent) setTabLoading(false);
    }
  };

  useEffect(() => {
    if (!username) return;
    loadCounts();
    if (activeTab === "posts") {
      loadPosts();
    } else if (activeTab === "favorites") {
      loadFavorites();
    } else {
      loadActivity();
    }
  }, [username, activeTab, page]);

  const loadCounts = async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await safeJson(res);
      if (data && !data.__error) {
        if (isOwnProfile) {
          updateProfile({ ...(authUser || {}), ...data });
        } else {
          setTargetProfile((prev: any) => ({ ...prev, ...data }));
        }
      }
    } catch {
      return;
    }
  };

  const likeSum = useMemo(() => posts.reduce((sum, item) => sum + (item.like_count || 0), 0), [posts]);
  const following = activeProfile?.following_count ?? 0;
  const follower = activeProfile?.follower_count ?? 0;
  const likes = likeSum;

  async function toggleFollow() {
    if (!token) return;
    const isFollowing = activeProfile?.is_following;
    try {
      if (isFollowing) {
        await fetch(`/api/follow/${username}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      } else {
        await fetch(`/api/follow`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ username }) });
      }
      fetchProfile(); // Refresh
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="profile-page profile-page--view">
      <div className="profile-shell">
        <section className="profile-cover" style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}>
          <div className="profile-cover-overlay"></div>
          <div className="profile-identity">
            <div className="profile-avatar">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-fallback">
                  {username?.[0]?.toUpperCase()}
                </div>
              )}
              {isOwnProfile && (
                <label className="profile-avatar-mask" style={{ cursor: "pointer" }}>
                  {"\u66f4\u6362\u5934\u50cf"}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                </label>
              )}
            </div>
            <div className="profile-identity-text">
              <div className="profile-name-row">
                {isOwnProfile ? (
                  <input
                    className="profile-name-input"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={"\u8bf7\u8f93\u5165\u6635\u79f0"}
                  />
                ) : (
                  <h1 className="profile-name-display">{nickname || username}</h1>
                )}
              </div>
              <div className="profile-handle">@{username || "--"}</div>
              {isOwnProfile ? (
                <input
                  className="profile-bio-input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={"\u8bf7\u8f93\u5165\u7b80\u4ecb"}
                />
              ) : (
                <p className="profile-bio-display">{bio || "这个人很懒，什么都没有写~"}</p>
              )}
            </div>

            {!isOwnProfile && token && (
              <div className="profile-identity-actions">
                <Link
                  href={`/messages?username=${username}`}
                  className="profile-msg-btn"
                >
                  发消息
                </Link>
                <button
                  onClick={toggleFollow}
                  className={`profile-follow-btn ${activeProfile?.is_following ? "is-following" : ""}`}
                >
                  {activeProfile?.is_following ? (
                    <>
                      <span className="follow-status-text">已关注</span>
                      <span className="unfollow-hover-text">取消关注</span>
                    </>
                  ) : (
                    "关注"
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="profile-cover-controls">
            {isOwnProfile && (
              <>
                <button
                  className="profile-cover-btn"
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                >
                  {coverUploading ? "\u4e0a\u4f20\u4e2d..." : "\u66f4\u6362\u5c01\u9762"}
                </button>
                <input
                  type="file"
                  ref={coverInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleCoverChange}
                />
              </>
            )}
          </div>
        </section>

        <section className="profile-tabs-row">
          <div className="profile-tabs">
            <button className={`profile-tab ${activeTab === "posts" ? "is-active" : ""}`} onClick={() => { setActiveTab("posts"); setPage(1); }}>
              {"\u6587\u7ae0"}
            </button>
            <button className={`profile-tab ${activeTab === "activity" ? "is-active" : ""}`} onClick={() => { setActiveTab("activity"); setPage(1); }}>
              {"\u52a8\u6001"}
            </button>
            {isOwnProfile && (
              <button className={`profile-tab ${activeTab === "favorites" ? "is-active" : ""}`} onClick={() => { setActiveTab("favorites"); setPage(1); }}>
                {"\u6536\u85cf"}
              </button>
            )}
          </div>
          <div className="profile-stats">
            <Link href={isOwnProfile ? "/following" : `/following?username=${username}`} className="profile-stat hover:bg-white/5 transition-colors cursor-pointer rounded-lg py-2 px-4 -my-2">
              <div className="profile-stat-label">{"\u5173\u6ce8\u6570"}</div>
              <div className="profile-stat-value">{following}</div>
            </Link>
            <Link href={isOwnProfile ? "/followers" : `/followers?username=${username}`} className="profile-stat hover:bg-white/5 transition-colors cursor-pointer rounded-lg py-2 px-4 -my-2">
              <div className="profile-stat-label">{"\u7c89\u4e1d\u6570"}</div>
              <div className="profile-stat-value">{follower}</div>
            </Link>
            <div className="profile-stat py-2 px-4">
              <div className="profile-stat-label">{"\u83b7\u8d5e\u6570"}</div>
              <div className="profile-stat-value">{likes}</div>
            </div>
          </div>
        </section>

        <section className="profile-main">
          <div className="profile-feed">
            <div className="profile-feed-title">
              {activeTab === "posts" ? "\u6587\u7ae0" : activeTab === "activity" ? "\u52a8\u6001" : "\u6536\u85cf"}
            </div>
            {tabLoading && <div className="profile-feed-empty">{"\u52a0\u8f7d\u4e2d..."}</div>}

            {!tabLoading && (activeTab === "posts" || activeTab === "favorites" || activeTab === "activity") && (
              <>
                {activeTab !== "activity" ? (
                  <div className="flex flex-col gap-4">
                    {(activeTab === "posts" ? posts : favorites).map((item: any) => (
                      <PostCard
                        key={item.slug || item.id}
                        post={item}
                        token={token}
                        onUpdate={(updated) => {
                          const updateList = (list: any[]) => list.map(p => (p.slug === updated.slug ? updated : p));
                          if (activeTab === "posts") setPosts(updateList(posts));
                          else setFavorites(updateList(favorites));
                        }}
                      />
                    ))}
                    {(activeTab === "posts" ? posts : favorites).length === 0 && (
                      <div className="profile-feed-empty">
                        {activeTab === "posts" ? "\u6682\u65e0\u6587\u7ae0" : "\u6682\u65e0\u6536\u85cf"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {activity.map((item, index) => (
                      <div key={index} className="bg-white/5 p-4 rounded-lg flex flex-col gap-2">
                        <div className="text-sm text-white/50">{formatDate(item.created_at)}</div>
                        <div className="text-base text-white/90">
                          {item.type === 'post' && (
                            <>
                              <span>{"\u53d1\u5e03\u4e86\u6587\u7ae0 "}</span>
                              <a href={`/post/${item.slug}`} className="text-accent hover:underline font-medium">《{item.title}》</a>
                            </>
                          )}
                          {item.type === 'like' && (
                            <>
                              <span>{"\u70b9\u8d5e\u4e86 "}</span>
                              <span className="font-medium text-white">{item.target_user || "Unknown"}</span>
                              <span>{" \u7684\u6587\u7ae0 "}</span>
                              <a href={`/post/${item.slug}`} className="text-accent hover:underline font-medium">《{item.title}》</a>
                            </>
                          )}
                          {item.type === 'comment' && (
                            <>
                              <span>{"\u8bc4\u8bba\u4e86 "}</span>
                              <span className="font-medium text-white">{item.target_user || "Unknown"}</span>
                              <span>{" \u7684\u6587\u7ae0 "}</span>
                              <a href={`/post/${item.slug}`} className="text-accent hover:underline font-medium">《{item.title}》</a>
                              <div className="mt-2 pl-3 border-l-2 border-white/20 text-white/70 italic text-sm line-clamp-2">
                                “{item.content}”
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {activity.length === 0 && (
                      <div className="profile-feed-empty">{"\u6682\u65e0\u52a8\u6001"}</div>
                    )}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="pagination flex items-center justify-center gap-4 mt-8">
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
              </>
            )}
          </div>
          <aside className="profile-side">
            <div className="profile-side-card">
              <h3>{"\u4e2a\u4eba\u8d44\u6599"}</h3>
              <div className="profile-side-row">
                <span>UID</span>
                <span>{username || "--"}</span>
              </div>
              <div className="profile-side-row">
                <span>{"\u6ce8\u518c\u65f6\u95f4"}</span>
                <span>{activeProfile?.created_at || "--"}</span>
              </div>
              {isOwnProfile && <p className="profile-side-tip">{"\u70b9\u51fb\u5934\u50cf\u53ef\u66f4\u6362\u5934\u50cf\uff0c\u70b9\u51fb\u6635\u79f0\u53ef\u76f4\u63a5\u7f16\u8f91\u3002"}</p>}
              {status === "error" && <p className="status error">{"\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"}</p>}
            </div>
          </aside>
        </section>
      </div >
    </div >
  );
}
