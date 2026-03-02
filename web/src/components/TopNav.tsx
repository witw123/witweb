"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/app/providers";
import { hasAdminAccess, normalizeRole } from "@/lib/rbac";

const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

export default function TopNav() {
  const { user, logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const canAccessAdmin = isAuthenticated && hasAdminAccess(normalizeRole(user?.role, user?.username === adminUsername));

  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(path);
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/70 backdrop-blur sticky top-0 z-50">
      <div className="container flex h-12 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight mr-8 text-white">witweb</Link>
        <nav className="flex items-center gap-2 mr-auto">
          <Link className={`nav-link ${isActive("/") ? "active" : ""}`} href="/">首页</Link>

          <Link className={`nav-link ${isActive("/studio") ? "active" : ""}`} href="/studio">工作台</Link>
          {isAuthenticated && (
            <>
              <Link className={`nav-link ${isActive("/publish") ? "active" : ""}`} href="/publish">发布文章</Link>
            </>
          )}
          <Link className={`nav-link ${isActive("/about") ? "active" : ""}`} href="/about">关于我</Link>
        </nav>
        {isAuthenticated ? (
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="btn-ghost" onClick={() => setOpen(!open)}>
                {user?.nickname || user?.username}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                  <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/profile" onClick={() => setOpen(false)}>个人中心</Link>
                  <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/favorites" onClick={() => setOpen(false)}>我的收藏</Link>
                  <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/following" onClick={() => setOpen(false)}>我的关注</Link>
                  {canAccessAdmin && (
                    <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/admin" onClick={() => setOpen(false)}>管理后台</Link>
                  )}
                  <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-800" onClick={() => { logout(); setOpen(false); }}>退出登录</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Link className="btn-ghost" href="/login">登录</Link>
          </div>
        )}
      </div>
    </header>
  );
}
