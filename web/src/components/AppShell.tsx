"use client";

/**
 * AppShell 应用程序外壳组件
 *
 * 根据当前路由路径决定使用哪种布局：
 * - /admin 路径使用简单布局（无顶部导航）
 * - 其他路径使用 LegacyLayout（带导航和 Footer）
 *
 * @component
 * @example
 * <AppShell>
 *   <PageContent />
 * </AppShell>
 */

import { usePathname } from "next/navigation";
import LegacyLayout from "@/components/LegacyLayout";

/**
 * AppShell 组件属性
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }
  return <LegacyLayout>{children}</LegacyLayout>;
}
