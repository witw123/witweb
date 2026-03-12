/**
 * 审计日志仓储层
 *
 * 负责管理系统操作审计日志，记录管理员的所有操作行为
 * 用于安全审计、合规检查和问题排查
 */

import { pgQuery, pgQueryOne } from "@/lib/postgres-query";
import type { PaginatedResult } from "./types";

/** 创建审计日志的数据参数 */
export interface CreateAdminAuditLogData {
  actor: string;
  action: string;
  targetType: string;
  targetId?: string;
  detailJson?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: string;
}

/** 审计日志数据库行 */
export interface AdminAuditLogRow {
  id: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  detail_json: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

function normalizePagination(page = 1, size = 20): { page: number; size: number; offset: number } {
  const validPage = Math.max(1, page);
  const validSize = Math.max(1, Math.min(100, size));
  const offset = (validPage - 1) * validSize;
  return { page: validPage, size: validSize, offset };
}

class AuditLogRepository {
  async createAdminLog(data: CreateAdminAuditLogData): Promise<number> {
    const row = await pgQueryOne<{ id: number }>(
      `INSERT INTO admin_audit_logs (actor, action, target_type, target_id, detail_json, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        data.actor,
        data.action,
        data.targetType,
        data.targetId || "",
        data.detailJson || "{}",
        data.ipAddress || "",
        data.userAgent || "",
        data.createdAt || new Date().toISOString(),
      ]
    );
    return Number(row?.id || 0);
  }

  async listAdminLogs(params: {
    page?: number;
    size?: number;
    actor?: string;
    action?: string;
    targetType?: string;
  }): Promise<PaginatedResult<AdminAuditLogRow>> {
    const { page = 1, size = 20, actor = "", action = "", targetType = "" } = params;
    const { page: validPage, size: validSize, offset } = normalizePagination(page, size);

    const filters: string[] = [];
    const values: unknown[] = [];
    if (actor.trim()) {
      filters.push("actor = ?");
      values.push(actor.trim());
    }
    if (action.trim()) {
      filters.push("action = ?");
      values.push(action.trim());
    }
    if (targetType.trim()) {
      filters.push("target_type = ?");
      values.push(targetType.trim());
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const total =
      (
        await pgQueryOne<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM admin_audit_logs ${where}`,
          values
        )
      )?.cnt || 0;

    const items = await pgQuery<AdminAuditLogRow>(
      `SELECT id, actor, action, target_type, target_id, detail_json, ip_address, user_agent, created_at
       FROM admin_audit_logs
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...values, validSize, offset]
    );

    return { items, total, page: validPage, size: validSize };
  }
}

export const auditLogRepository = new AuditLogRepository();
