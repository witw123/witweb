"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/app/providers";

export default function TopNav() {
  const { user, logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/70 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold">witweb</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="link" href="/">首页</Link>
          <Link className="link" href="/forum">论坛</Link>
          <Link className="link" href="/studio">工作台</Link>
          {isAuthenticated && <Link className="link" href="/admin">管理后台</Link>}
        </nav>
        {isAuthenticated ? (
          <div className="relative">
            <button className="btn-ghost" onClick={() => setOpen(!open)}>
              {user?.nickname || user?.username}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/profile" onClick={() => setOpen(false)}>个人中心</Link>
                <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/favorites" onClick={() => setOpen(false)}>我的收藏</Link>
                <Link className="block rounded px-3 py-2 text-sm hover:bg-zinc-800" href="/following" onClick={() => setOpen(false)}>我的关注</Link>
                <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-800" onClick={() => { logout(); setOpen(false); }}>退出登录</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <Link className="btn-ghost" href="/login">登录</Link>
            <Link className="btn-primary" href="/register">注册</Link>
          </div>
        )}
      </div>
    </header>
  );
}
