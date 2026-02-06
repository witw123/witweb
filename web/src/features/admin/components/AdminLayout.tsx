"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !token) {
      router.push("/admin/login");
      return;
    }

    void fetch("/api/admin/stats/overview", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      if (!res.ok) {
        logout();
        router.push("/admin/login");
      }
    });
  }, [loading, isAuthenticated, token, logout, router, pathname]);

  const navItems = [
    { href: "/admin", label: "仪表盘" },
    { href: "/admin/users", label: "用户管理" },
    { href: "/admin/blogs", label: "文章管理" },
    { href: "/admin/categories", label: "分类管理" },
    { href: "/admin/friends", label: "友链管理" },
  ];

  const isActive = (href: string) => pathname === href || (href === "/admin" && pathname === "/admin/dashboard");

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>管理台</h2>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? "active" : ""}`}>
              <span className="nav-icon">•</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.nickname || user?.username || "管理员"}</div>
            <div className="user-role">管理员</div>
          </div>
          <button
            className="logout-btn"
            type="button"
            onClick={() => {
              logout();
              router.push("/admin/login");
            }}
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
