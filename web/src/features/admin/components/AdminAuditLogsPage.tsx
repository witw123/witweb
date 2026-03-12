/**
 * AdminAuditLogsPage - 审计日志管理页面组件
 *
 * 展示后台操作的审计日志，支持按操作人、动作代码和对象类型筛选。
 * 用于管理员查看系统关键操作的记录。
 *
 * @component
 * @example
 * <AdminAuditLogsPage />
 */
"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { getPaginated } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import AdminNotice from "./AdminNotice";
import { getRoleLabel, normalizeRole } from "@/lib/rbac";
import { ADMIN_LIST_PAGE_SIZE } from "@/features/admin/constants";

type AuditLogItem = {
  id: number;
  actor: string;
  action: string;
  action_label?: string;
  target_type: string;
  target_type_label?: string;
  target_id: string;
  summary?: string;
  detail_json: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
};

function safeParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (key === "from" || key === "to" || key === "role") {
    return getRoleLabel(normalizeRole(String(value)));
  }
  if (key === "status") {
    const mapping: Record<string, string> = {
      published: "已发布",
      draft: "草稿",
      deleted: "已删除",
      active: "启用",
      inactive: "停用",
    };
    return mapping[String(value)] || String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.join("、");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function detailLabel(key: string): string {
  const labels: Record<string, string> = {
    from: "原角色",
    to: "新角色",
    role: "角色",
    ids: "ID 列表",
    usernames: "用户名列表",
    updated: "更新数量",
    deleted: "删除数量",
    status: "状态",
    changed: "变更字段",
    category_id: "分类 ID",
    key: "配置键",
    name: "名称",
    url: "链接",
    is_active: "启用状态",
  };
  return labels[key] || key;
}

export default function AdminAuditLogsPage() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const pageSize = ADMIN_LIST_PAGE_SIZE;

  const filters = useMemo(
    () => ({
      page,
      size: pageSize,
      actor: actor.trim(),
      action: action.trim(),
      targetType: targetType.trim(),
    }),
    [action, actor, page, pageSize, targetType],
  );

  const auditLogsQuery = useQuery({
    queryKey: queryKeys.adminAuditLogs(filters),
    enabled: isAuthenticated,
    queryFn: () =>
      getPaginated<AuditLogItem>("/api/admin/audit-logs", {
        page: filters.page,
        size: filters.size,
        actor: filters.actor,
        action: filters.action,
        target_type: filters.targetType,
      }),
  });

  const items = auditLogsQuery.data?.items || [];
  const total = auditLogsQuery.data?.total || 0;
  const totalPages = Math.max(1, auditLogsQuery.data?.totalPages || 1);
  const loading = auditLogsQuery.isLoading;
  const error = auditLogsQuery.error instanceof Error ? auditLogsQuery.error.message : "";

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">审计日志</h1>
        <p className="page-subtitle">记录后台关键操作，支持按操作人、动作和对象类型筛选。</p>
      </div>

      <div className="admin-card">
        <div className="card-header admin-audit-toolbar">
          <input
            className="admin-input admin-audit-input-actor"
            placeholder="操作人"
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="admin-input admin-audit-input-action"
            placeholder="动作代码（可选）"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="admin-select"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部对象</option>
            <option value="user">用户</option>
            <option value="post">文章</option>
            <option value="category">分类</option>
            <option value="security">安全配置</option>
            <option value="friend_link">友链</option>
            <option value="system">系统</option>
          </select>
          <button className="btn-admin btn-admin-secondary" onClick={() => void auditLogsQuery.refetch()}>
            刷新
          </button>
          <div className="admin-audit-total">共 {total} 条</div>
        </div>

        <AdminNotice message={error} tone="error" />

        {!loading && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>动作</th>
                <th>对象</th>
                <th>摘要</th>
                <th>IP</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const detail = safeParseJson(item.detail_json);
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString("zh-CN")}</td>
                    <td>{item.actor}</td>
                    <td>{item.action_label || item.action}</td>
                    <td>
                      {item.target_type_label || item.target_type}
                      {item.target_id ? ` #${item.target_id}` : ""}
                    </td>
                    <td className="admin-audit-summary">{item.summary || "-"}</td>
                    <td>{item.ip_address || "-"}</td>
                    <td className="admin-audit-detail-cell">
                      {detail && Object.keys(detail).length > 0 ? (
                        <div className="admin-audit-detail-list">
                          {Object.entries(detail).map(([key, value]) => (
                            <div key={key} className="admin-audit-detail-item">
                              <span className="admin-audit-detail-label">{detailLabel(key)}：</span>
                              <span>{formatValue(key, value)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="admin-audit-detail-empty">无</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="admin-table-pagination">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="btn-admin btn-admin-secondary"
            >
              上一页
            </button>
            <span className="admin-table-pagination-label">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="btn-admin btn-admin-secondary"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
