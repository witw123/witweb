"use client";

import DashboardPage from "@/features/admin/components/DashboardPage";

/**
 * 管理后台首页
 *
 * 管理后台的入口页面，重定向到仪表盘
 * 访问 /admin 时显示管理仪表盘
 */
export default function AdminIndex() {
  return <DashboardPage />;
}
