"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { getThumbnailUrl } from "@/utils/url";

const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isStudio = pathname.startsWith("/studio");

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
    setShowUserMenu(false);
  };

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
          </nav>

          {isMobileMenuOpen && (
            <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
          )}

          <div className="actions">
            {isAuthenticated ? (
              <div className="user-menu-container">
                <button className="user-button" onClick={() => setShowUserMenu(!showUserMenu)}>
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
                  <div className="user-dropdown">
                    <Link href="/profile" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                      个人中心
                    </Link>
                    <Link href="/favorites" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                      我的收藏
                    </Link>
                    <Link href="/following" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                      我的关注
                    </Link>
                    <button onClick={handleLogout} className="dropdown-item">退出登录</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <Link href="/login" className="btn-ghost">登录</Link>
                <Link href="/register" className="btn-primary">注册</Link>
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
