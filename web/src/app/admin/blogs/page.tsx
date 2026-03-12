"use client";

import BlogManagementPage from "@/features/admin/components/BlogManagementPage";

/**
 * 博客管理页面
 *
 * 提供博客文章的管理功能，包括：
 * - 查看所有博客文章列表
 * - 创建新博客文章
 * - 编辑现有文章
 * - 删除文章
 * - 文章审核状态管理
 *
 * @route /admin/blogs
 */
export default function AdminBlogs() {
  return <BlogManagementPage />;
}
