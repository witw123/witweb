"use client";

import AdminLayout from "@/features/admin/components/AdminLayout";
import { usePathname } from "next/navigation";

/**
 * 管理后台布局组件
 *
 * 为管理后台页面提供统一的布局结构。
 * 根据当前路径判断：
 * - /admin/login: 登录页面不使用管理布局（独立登录页面）
 * - 其他路径: 使用 AdminLayout 组件，包含侧边栏导航和顶部栏
 *
 * @param children - 子页面组件
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return <AdminLayout>{children}</AdminLayout>;
}
