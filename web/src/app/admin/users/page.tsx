"use client";

import UserManagementPage from "@/features/admin/components/UserManagementPage";

/**
 * 用户管理页面
 *
 * 提供系统用户的管理功能，包括：
 * - 查看所有用户列表
 * - 编辑用户信息
 * - 修改用户角色
 * - 禁用/启用用户账号
 * - 用户权限管理
 *
 * @route /admin/users
 */
export default function AdminUsers() {
  return <UserManagementPage />;
}
