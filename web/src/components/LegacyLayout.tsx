"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { getThumbnailUrl } from "@/utils/url";

const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, updateProfile, isAuthenticated, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const isStudio = pathname.startsWith("/studio");

  const toggleUserMenu = async () => {
    const nextState = !showUserMenu;
    setShowUserMenu(nextState);
    if (nextState && isAuthenticated && token) {
      try {
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.profile) {
          updateProfile(data.profile);
        }
      } catch (err) { }
    }
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
    setShowUserMenu(false);
  };

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!showUserMenu) return;
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showUserMenu]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages/unread");
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      } catch (err) { }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const navClass = (path: string) =>
    pathname === path || (path === "/studio" && isStudio)
      ? "nav-link active"
      : "nav-link";

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-content">
          <Link href="/" className="brand">witweb</Link>

          <button className="mobile-menu-toggle" onClick={toggleMobileMenu} aria-label="Toggle navigation">
            <span className={`hamburger ${isMobileMenuOpen ? "active" : ""}`}></span>
          </button>

          <nav className={`nav ${isMobileMenuOpen ? "mobile-open" : ""}`}>
            <Link href="/" className={navClass("/")} onClick={closeMobileMenu}>首页</Link>
            <Link href="/forum" className={navClass("/forum")} onClick={closeMobileMenu}>论坛</Link>
            {isAuthenticated && user?.username === adminUsername && (
              <Link href="/admin" className="nav-link" onClick={closeMobileMenu}>管理后台</Link>
            )}
            <Link href="/studio" className={navClass("/studio")} onClick={closeMobileMenu}>工作台</Link>
            {isAuthenticated && (
              <Link href="/publish" className={navClass("/publish")} onClick={closeMobileMenu}>发布文章</Link>
            )}
          </nav>

          {isMobileMenuOpen && (
            <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
          )}

          <div className="actions">
            {isAuthenticated ? (
              <>
                <div className="header-message-link">
                  <Link href="/messages" className={`nav-link ${pathname === "/messages" ? "active" : ""}`}>
                    消息
                    {unreadCount > 0 && (
                      <span className="unread-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                    )}
                  </Link>
                </div>
                <div className="user-menu-container" ref={userMenuRef}>
                  <button className="user-button" onClick={toggleUserMenu}>
                    {user?.avatar_url ? (
                      <img
                        src={getThumbnailUrl(user.avatar_url, 64)}
                        alt={user.nickname || user.username}
                        className="user-avatar"
                      />
                    ) : (
                      <div className="user-avatar-fallback">
                        {(user?.nickname || user?.username)?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="user-name">{user?.nickname || user?.username}</span>
                    <svg className="dropdown-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 8L2 4h8L6 8z" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <div className="user-dropdown-card">
                      <div className="user-dropdown-cover"></div>
                      <div className="user-dropdown-body">
                        <div className="user-dropdown-avatar">
                          {user?.avatar_url ? (
                            <img
                              src={getThumbnailUrl(user.avatar_url, 96)}
                              alt={user.nickname || user.username}
                            />
                          ) : (
                            <div className="user-dropdown-avatar-fallback">
                              {(user?.nickname || user?.username)?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="user-dropdown-name">{user?.nickname || user?.username}</div>
                        <div className="user-dropdown-handle">@{user?.username || "user"}</div>
                        <div className="user-dropdown-stats">
                          <Link href="/following" className="user-stat hover:bg-white/5 transition-colors cursor-pointer rounded-md py-1" onClick={() => setShowUserMenu(false)}>
                            <div className="user-stat-value">{user?.following_count ?? 0}</div>
                            <div className="user-stat-label">{"关注"}</div>
                          </Link>
                          <Link href="/followers" className="user-stat hover:bg-white/5 transition-colors cursor-pointer rounded-md py-1" onClick={() => setShowUserMenu(false)}>
                            <div className="user-stat-value">{user?.follower_count ?? 0}</div>
                            <div className="user-stat-label">{"粉丝"}</div>
                          </Link>
                          <Link href="/profile?tab=activity" className="user-stat hover:bg-white/5 transition-colors cursor-pointer rounded-md py-1" onClick={() => setShowUserMenu(false)}>
                            <div className="user-stat-value">{user?.post_count ?? 0}</div>
                            <div className="user-stat-label">{"动态"}</div>
                          </Link>
                        </div>
                        <div className="user-dropdown-links">
                          <Link href="/profile" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                            {"\u4e2a\u4eba\u4e2d\u5fc3"}
                          </Link>
                          <Link href="/favorites" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                            {"\u6211\u7684\u6536\u85cf"}
                          </Link>
                          <button onClick={handleLogout} className="dropdown-item danger">{"\u9000\u51fa\u767b\u5f55"}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="auth-buttons">
                <Link href="/login" className="btn-ghost">{"登录"}</Link>
                <Link href="/register" className="btn-primary">{"注册"}</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`main-content ${isStudio ? "full-width" : "container"}`}>
        {children}
      </main>

      <footer className="footer">
        <div className="container">
          <p>© {new Date().getFullYear()} witweb. 基于 Next.js 构建</p>
        </div>
      </footer>
    </div>
  );
}
