"use client";

import FriendLinksManagement from "@/features/admin/components/FriendLinksManagement";

/**
 * 友链管理页面
 *
 * 提供友链（Friend Links）的管理功能，包括：
 * - 查看所有友链列表
 * - 添加新友链
 * - 编辑友链信息（名称、URL、描述、图标）
 * - 删除友链
 * - 友链启用/禁用管理
 *
 * @route /admin/friends
 */
export default function AdminFriendsPage() {
  return <FriendLinksManagement />;
}
