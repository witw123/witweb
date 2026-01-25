import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const normalizedQuery = submittedQuery.trim().toLowerCase();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileData, setProfileData] = useState(null);
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const isAdmin = profileData?.username === "witw";
  const [authorFilter, setAuthorFilter] = useState("");

  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem("profile");
      setProfileData(storedProfile ? JSON.parse(storedProfile) : null);
    } catch {
      setProfileData(null);
    }
  }, []);

  useEffect(() => {
    if (profileData) {
      setProfileName(profileData.nickname || profileData.username || "");
      setProfileAvatar(profileData.avatar_url || "");
    }
  }, [profileData]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    }
    if (showProfile) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfile]);

  function loadPosts(options = {}) {
    const { showLoading = false } = options;
    if (showLoading) {
      setStatus("loading");
    }
    fetch("/api/blog")
      .then((res) => res.json())
      .then((data) => {
        setPosts(Array.isArray(data) ? data : []);
        setStatus("ready");
      })
      .catch(() => {
        if (showLoading) {
          setStatus("error");
        }
      });
  }

  useEffect(() => {
    loadPosts({ showLoading: true });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [submittedQuery]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [authorFilter]);

  async function publish() {
    setPublishStatus("");
    if (!title.trim() || !content.trim()) {
      setPublishStatus("标题和内容不能为空。");
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
      setPublishStatus(data.detail || "发布失败。");
      return;
    }
    setPublishStatus("已发布");
    setTitle("");
    setTags("");
    setContent("");
    loadPosts({ showLoading: false });
  }

  async function saveProfile(overrides = {}) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const payload = {
      nickname: profileName,
      avatar_url: profileAvatar,
      ...overrides,
    };
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await res.json().catch(() => ({}));
      return;
    }
    const data = await res.json();
    if (data.profile) {
      localStorage.setItem("profile", JSON.stringify(data.profile));
      setProfileData(data.profile);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("profile");
    setShowProfile(false);
    setProfileData(null);
    navigate("/");
  }

  const filteredPosts = posts.filter((post) => {
    const titleMatch = post.title.toLowerCase().includes(normalizedQuery);
    const authorMatch = authorFilter ? post.author === authorFilter : true;
    return titleMatch && authorMatch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Sora2 Studio Pro</h1>
          <p className="muted">讨论区 · 分享创作日志与经验</p>
        </div>
        <nav className="nav-links">
          <a className="nav-link studio-link" href="/studio" target="_blank" rel="noreferrer">
            工作区
          </a>
        </nav>
        <div className="actions">
          {profileData ? (
            <div className="profile-menu" ref={profileRef}>
              <button className="user-chip vertical" type="button" onClick={() => setShowProfile(!showProfile)}>
                {profileData.avatar_url ? (
                  <img src={profileData.avatar_url} alt={profileData.nickname} />
                ) : (
                  <div className="avatar-fallback">{profileData.nickname?.[0] || "U"}</div>
                )}
              </button>
              {showProfile && (
                <div className="profile-pop card" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="form">
                    <div className="profile-inline">
                      {profileData?.avatar_url ? (
                        <img
                          src={profileData.avatar_url}
                          alt={profileData.nickname}
                          onClick={() => document.getElementById("avatarFile")?.click()}
                        />
                      ) : (
                        <div
                          className="avatar-fallback large"
                          onClick={() => document.getElementById("avatarFile")?.click()}
                        >
                          {profileData?.nickname?.[0] || "U"}
                        </div>
                      )}
                      <div>
                        <div className="profile-name-edit">
                          <input
                            className="profile-name-input"
                            value={profileName}
                            onChange={(event) => setProfileName(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onBlur={saveProfile}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                saveProfile();
                              }
                            }}
                            placeholder="昵称"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="profile-stats">
                      <button
                        className="stat-card"
                        type="button"
                        onClick={() => {
                          if (profileData?.username) {
                            setAuthorFilter(profileData.username);
                          }
                        }}
                      >
                        <strong>{posts.length}</strong>
                        <span>文章</span>
                      </button>
                    </div>
                    <div className="avatar-upload">
                      <input
                        id="avatarFile"
                        className="file-input"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const nextAvatar = String(reader.result || "");
                            setProfileAvatar(nextAvatar);
                            saveProfile({ avatar_url: nextAvatar });
                          };
                          reader.readAsDataURL(file);
                          event.target.value = "";
                        }}
                      />
                    </div>
                    <div className="profile-actions">
                      <button className="button ghost" type="button" onClick={handleLogout}>
                        退出登录
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>
      <div className="split">
        <aside className="side-panel">
          <div className="card form">
            <h3>发布新文章</h3>
            {!localStorage.getItem("token") ? (
              <>
                <p className="muted">登录后可在此发布文章。</p>
                <Link className="button ghost" to="/login">
                  去登录
                </Link>
              </>
            ) : (
              <>
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
                    rows={10}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="使用 Markdown 写作..."
                  />
                </label>
                {publishStatus && <p className="status">{publishStatus}</p>}
                <button className="button primary" type="button" onClick={publish}>
                  发布
                </button>
              </>
            )
          }
          </div>
        </aside>

        <section>
          {status === "loading" && <p>加载中...</p>}
          {status === "error" && <p>加载失败，请稍后再试。</p>}
          {status === "ready" && posts.length === 0 && <p>暂无文章，去左侧发布第一篇吧。</p>}

          <div className="section-header">
            <h3>最新文章</h3>
            <div className="search">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSubmittedQuery(query);
                  }
                }}
                placeholder="搜索标题..."
              />
              {submittedQuery && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSubmittedQuery("");
                  }}
                >
                  清空
                </button>
              )}
              {authorFilter && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => setAuthorFilter("")}
                >
                  仅看我的文章
                </button>
              )}
              <span className="muted">共 {posts.length} 篇</span>
            </div>
          </div>

          <div className="list">
            {filteredPosts
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((post) => {
                const title = post.title;
                const rawPreview = (post.content || "").replace(/\s+/g, " ").trim();
                const preview =
                  rawPreview.length > 0
                    ? `${rawPreview.slice(0, 160)}${rawPreview.length > 160 ? "..." : ""}`
                    : "暂无预览";
                const tagList = (post.tags || "")
                  .split(/[,，]/)
                  .map((tag) => tag.trim())
                  .filter(Boolean);
                const matchIndex = normalizedQuery
                  ? title.toLowerCase().indexOf(normalizedQuery)
                  : -1;
                return (
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
                    <h2>
                      {matchIndex >= 0 ? (
                        <>
                          {title.slice(0, matchIndex)}
                          <span className="highlight">
                            {title.slice(matchIndex, matchIndex + normalizedQuery.length)}
                          </span>
                          {title.slice(matchIndex + normalizedQuery.length)}
                        </>
                      ) : (
                        title
                      )}
                    </h2>
                    <p className="excerpt">{preview}</p>
                    <div className="post-card-footer">
                      <div className="post-card-meta">
                        <span className="muted">{new Date(post.created_at).toLocaleString()}</span>
                        {tagList.length > 0 && (
                          <div className="tag-list">
                            {tagList.map((tag) => (
                              <span key={tag} className="tag-pill">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="post-card-actions">
                        <button
                          className="meta-like"
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            const token = localStorage.getItem("token");
                            if (!token) {
                              navigate("/login");
                              return;
                            }
                              fetch(`/api/blog/${post.slug}/like`, {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                              })
                                .then(() => loadPosts({ showLoading: false }))
                                .catch(() => {});
                            }}
                          >
                          赞 {post.like_count ?? 0}
                        </button>
                        <button
                          className="meta-like"
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            const token = localStorage.getItem("token");
                            if (!token) {
                              navigate("/login");
                              return;
                            }
                            fetch(`/api/blog/${post.slug}/dislike`, {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                            })
                              .then((res) => res.json())
                              .then(() => loadPosts({ showLoading: false }))
                              .catch(() => {});
                          }}
                        >
                          踩 {post.dislike_count ?? 0}
                        </button>
                        <span>评论 {post.comment_count ?? 0}</span>
                        <span className="read-more">阅读全文 →</span>
                        {isAdmin && (
                          <button
                            className="meta-like"
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              const ok = confirm("确认删除这篇文章吗？");
                              if (!ok) return;
                              const token = localStorage.getItem("token");
                              if (!token) {
                                navigate("/login");
                                return;
                              }
                              fetch(`/api/admin/post/${post.slug}`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${token}` },
                              })
                                .then(() => loadPosts({ showLoading: false }))
                                .catch(() => {});
                            }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="button ghost"
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <span className="muted">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                className="button ghost"
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
