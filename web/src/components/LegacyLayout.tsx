"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";
import { hasAdminAccess, normalizeRole } from "@/lib/rbac";
import Footer from "./Footer";
import VisitTracker from "./VisitTracker";

const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, updateProfile, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const isStudio = pathname.startsWith("/studio");
  const isHome = pathname === "/";
  const canAccessAdmin = isAuthenticated && hasAdminAccess(normalizeRole(user?.role, user?.username === adminUsername));
  const userAvatarSrc = user?.avatar_url ? getThumbnailUrl(user.avatar_url, 64) : "";
  const userAvatarLargeSrc = user?.avatar_url ? getThumbnailUrl(user.avatar_url, 96) : "";
  const userAvatarUnoptimized = shouldBypassImageOptimization(userAvatarSrc);
  const userAvatarLargeUnoptimized = shouldBypassImageOptimization(userAvatarLargeSrc);
  const unreadQuery = useQuery({
    queryKey: queryKeys.messageNotifications("unread-count"),
    queryFn: () => get<{ unread_count: number }>(getVersionedApiPath("/messages/unread")),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 30000 : false,
    staleTime: 15 * 1000,
  });
  const unreadCount = unreadQuery.data?.unread_count || 0;

  const toggleUserMenu = async () => {
    const nextState = !showUserMenu;
    setShowUserMenu(nextState);
    if (nextState && isAuthenticated) {
      try {
        const data = await get<{ profile: typeof user }>(getVersionedApiPath("/profile"));
        if (data?.profile) {
          updateProfile(data.profile);
        }
      } catch {}
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

  const navClass = (path: string) =>
    pathname === path || (path === "/studio" && isStudio) ? "nav-link active" : "nav-link";

  return (
    <div className="layout">
      <VisitTracker />
      <header className="header">
        <div className="container header-content">
          <Link href="/" className="brand">
            witweb
          </Link>

          <button className="mobile-menu-toggle" onClick={toggleMobileMenu} aria-label="Toggle navigation">
            <span className={`hamburger ${isMobileMenuOpen ? "active" : ""}`}></span>
          </button>

          <nav className={`nav ${isMobileMenuOpen ? "mobile-open" : ""}`}>
            <Link href="/" className={navClass("/")} onClick={closeMobileMenu}>
              首页
            </Link>
            <Link href="/categories" className={navClass("/categories")} onClick={closeMobileMenu}>
              分类
            </Link>
            <Link href="/studio" className={navClass("/studio")} onClick={closeMobileMenu}>
              工作台
            </Link>
            <Link href="/friends" className={navClass("/friends")} onClick={closeMobileMenu}>
              友链
            </Link>
            {isAuthenticated && (
              <Link href="/publish" className={navClass("/publish")} onClick={closeMobileMenu}>
                发布文章
              </Link>
            )}
            <Link href="/about" className={navClass("/about")} onClick={closeMobileMenu}>
              关于我
            </Link>
          </nav>

          {isMobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>}

          <div className="actions">
            {isAuthenticated ? (
              <>
                <div className="header-message-link">
                  <Link href="/messages" className={`nav-link ${pathname === "/messages" ? "active" : ""}`}>
                    消息
                    {unreadCount > 0 && <span className="unread-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                  </Link>
                </div>

                <div className="user-menu-container" ref={userMenuRef}>
                  <button className="user-button" onClick={toggleUserMenu}>
                    {user?.avatar_url ? (
                      <Image
                        src={userAvatarSrc}
                        alt={user.nickname || user.username}
                        width={32}
                        height={32}
                        className="user-avatar"
                        unoptimized={userAvatarUnoptimized}
                      />
                    ) : (
                      <div className="user-avatar-fallback">{(user?.nickname || user?.username)?.[0]?.toUpperCase()}</div>
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
                            <Image
                              src={userAvatarLargeSrc}
                              alt={user.nickname || user.username}
                              width={72}
                              height={72}
                              unoptimized={userAvatarLargeUnoptimized}
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
                          <Link
                            href="/following"
                            className="user-stat hover:bg-white/5 transition-colors cursor-pointer rounded-md py-1"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <div className="user-stat-value">{user?.following_count ?? 0}</div>
                            <div className="user-stat-label">关注</div>
                          </Link>
                          <Link
                            href="/followers"
                            className="user-stat hover:bg-white/5 transition-colors cursor-pointer rounded-md py-1"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <div className="user-stat-value">{user?.follower_count ?? 0}</div>
                            <div className="user-stat-label">粉丝</div>
                          </Link>
                          <Link
                            href="/profile?tab=activity"
                            className="user-stat hover:bg-white/5 transition-colors cursor-pointer rounded-md py-1"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <div className="user-stat-value">{user?.activity_count ?? user?.post_count ?? 0}</div>
                            <div className="user-stat-label">动态</div>
                          </Link>
                        </div>
                        <div className="user-dropdown-links">
                          <Link href="/profile" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                            个人中心
                          </Link>
                          <Link href="/favorites" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                            我的收藏
                          </Link>
                          {canAccessAdmin && (
                            <Link href="/admin" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                              管理后台
                            </Link>
                          )}
                          <button onClick={handleLogout} className="dropdown-item danger">
                            退出登录
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="auth-buttons">
                <Link href="/login" className="btn-ghost">
                  登录
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`main-content ${isStudio || isHome ? "full-width" : "container"}`}>{children}</main>

      <Footer />
    </div>
  );
}
