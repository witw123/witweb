/**
 * AdminLayout - 管理后台布局组件
 *
 * 为管理后台页面提供统一的布局结构，包含侧边栏导航、顶部栏和内容区域。
 * 负责管理员权限验证和基于角色的导航项展示。
 *
 * @component
 * @param {object} props - 组件属性
 * @param {React.ReactNode} props.children - 子页面内容
 * @example
 * <AdminLayout>
 *   <DashboardPage />
 * </AdminLayout>
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { getRoleLabel, hasAdminPermission, normalizeRole, type AppRole } from "@/lib/rbac";
import AdminNotice from "./AdminNotice";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type PermissionResponse = {
  success?: boolean;
  data?: {
    role?: string;
  };
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const validatedSessionRef = useRef(false);
  const [authCheckWarning, setAuthCheckWarning] = useState("");
  const [authNoticeTone, setAuthNoticeTone] = useState<"success" | "error" | "info">("info");
  const [resolvedRole, setResolvedRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      validatedSessionRef.current = false;
      router.replace("/admin/login");
      return;
    }
    if (validatedSessionRef.current) return;

    const controller = new AbortController();
    void fetch("/api/admin/me/permissions", {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as PermissionResponse;
          validatedSessionRef.current = true;
          setAuthNoticeTone("info");
          setAuthCheckWarning("");
          if (typeof data?.data?.role === "string") {
            setResolvedRole(normalizeRole(data.data.role));
          }
          return;
        }

        if (res.status === 401 || res.status === 403) {
          validatedSessionRef.current = false;
          logout();
          router.replace("/admin/login");
          return;
        }
        setAuthNoticeTone("error");
        setAuthCheckWarning("管理员权限校验暂时失败，请稍后重试。");
      })
      .catch((error: unknown) => {
        const aborted = error instanceof Error && error.name === "AbortError";
        if (!aborted) {
          setAuthNoticeTone("error");
          setAuthCheckWarning("网络波动，暂时无法完成权限校验。");
        }
      });

    return () => controller.abort();
  }, [loading, isAuthenticated, logout, router]);

  const role = resolvedRole || normalizeRole(user?.role);

  const navItems = useMemo(
    () =>
      [
        hasAdminPermission(role, "dashboard.view")
          ? { href: "/admin", label: "仪表盘", icon: "DB" }
          : null,
        hasAdminPermission(role, "users.manage")
          ? { href: "/admin/users", label: "用户管理", icon: "US" }
          : null,
        hasAdminPermission(role, "blogs.manage")
          ? { href: "/admin/blogs", label: "文章管理", icon: "BL" }
          : null,
        hasAdminPermission(role, "categories.manage")
          ? { href: "/admin/categories", label: "分类管理", icon: "CT" }
          : null,
        hasAdminPermission(role, "friends.manage")
          ? { href: "/admin/friends", label: "友链管理", icon: "FL" }
          : null,
        hasAdminPermission(role, "audit.read")
          ? { href: "/admin/audit-logs", label: "审计日志", icon: "AU" }
          : null,
        hasAdminPermission(role, "api.read")
          ? { href: "/admin/apis", label: "API 管理", icon: "API" }
          : null,
      ].filter(Boolean) as NavItem[],
    [role]
  );

  const activeItem = navItems.find(
    (item) => pathname === item.href || (item.href === "/admin" && pathname === "/admin/dashboard")
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Admin</h2>
          <p>管理控制台</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const active =
              pathname === item.href || (item.href === "/admin" && pathname === "/admin/dashboard");
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.nickname || user?.username || "管理员"}</div>
            <div className="user-role">{getRoleLabel(role)}</div>
          </div>
          <button
            className="logout-btn"
            type="button"
            onClick={() => {
              logout();
              router.replace("/admin/login");
            }}
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          <div className="admin-topbar">
            <div className="topbar-title">当前页面：{activeItem?.label || "管理后台"}</div>
            <div className="topbar-role">{getRoleLabel(role)}</div>
          </div>
          <AdminNotice message={authCheckWarning} tone={authNoticeTone} />
          {children}
        </div>
      </main>
    </div>
  );
}
