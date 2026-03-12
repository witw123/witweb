import AdminAuditLogsPage from "@/features/admin/components/AdminAuditLogsPage";

/**
 * 审计日志页面
 *
 * 显示系统操作审计日志，记录管理员和用户的操作行为。
 * 主要功能包括：
 * - 查看所有审计日志列表
 * - 按时间范围筛选日志
 * - 按操作类型筛选
 * - 按操作用户筛选
 * - 导出审计日志
 *
 * @route /admin/audit-logs
 */
export default function Page() {
  return <AdminAuditLogsPage />;
}
