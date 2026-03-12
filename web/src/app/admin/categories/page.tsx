"use client";

import CategoryManagementPage from "@/features/admin/components/CategoryManagementPage";

/**
 * 分类管理页面
 *
 * 提供博客文章分类的管理功能，包括：
 * - 查看所有分类列表
 * - 创建新分类
 * - 编辑分类名称和描述
 * - 删除分类
 * - 分类排序管理
 *
 * @route /admin/categories
 */
export default function AdminCategoriesPage() {
  return <CategoryManagementPage />;
}

