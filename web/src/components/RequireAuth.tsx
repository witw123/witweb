"use client";

/**
 * RequireAuth 需要认证组件
 *
 * 用于保护需要用户登录才能访问的页面。
 * 如果用户未登录，会自动重定向到登录页面。
 * 显示加载状态直到认证状态确定。
 *
 * @component
 * @example
 * <RequireAuth>
 *   <ProtectedPage />
 * </RequireAuth>
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

/**
 * RequireAuth 组件属性
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) return <div className="container py-10">{"\u52a0\u8f7d\u4e2d..."}</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
