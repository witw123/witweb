"use client";

import DashboardPage from "@/features/admin/components/DashboardPage";

/**
 * 管理后台仪表盘页面
 *
 * 显示系统概览数据，包括：
 * - 用户数量统计
 * - 博客文章数量统计
 * - 最近活动等
 *
 * @route /admin/dashboard
 */
export default function AdminDashboard() {
  return <DashboardPage />;
}
