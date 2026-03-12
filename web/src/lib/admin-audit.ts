/**
 * 管理审计日志工具
 *
 * 提供管理员操作审计功能，记录所有管理后台的操作行为。
 * 审计日志用于安全合规、问题排查和操作追溯。
 * 注意：审计失败不会中断主业务逻辑，保证管理操作正常执行。
 *
 * @module admin-audit
 */

import { auditLogRepository } from "@/lib/repositories";

/**
 * 审计目标类型
 *
 * @typedef {"user" | "post" | "category" | "security" | "friend_link" | "system"} AdminAuditTargetType
 */
export type AdminAuditTargetType =
  | "user"
  | "post"
  | "category"
  | "security"
  | "friend_link"
  | "system";

/**
 * 审计日志载荷
 *
 * @interface AdminAuditPayload
 */
export interface AdminAuditPayload {
  /** 操作者标识（用户名或 ID） */
  actor: string;
  /** 操作类型（描述操作名称） */
  action: string;
  /** 目标资源类型 */
  targetType: AdminAuditTargetType;
  /** 目标资源 ID（可选） */
  targetId?: string;
  /** 操作详情（可选的额外信息） */
  detail?: Record<string, unknown>;
  /** HTTP 请求对象（用于提取 IP 和 User-Agent） */
  req?: Request;
}

/**
 * 获取客户端 IP 地址
 *
 * 从请求头中提取真实客户端 IP，支持代理场景。
 *
 * @param {Request | undefined} req - HTTP 请求对象
 * @returns {string} 客户端 IP，未知时返回空字符串
 */
function getClientIp(req?: Request): string {
  if (!req) return "";
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return req.headers.get("x-real-ip") || "";
}

/**
 * 获取客户端 User-Agent
 *
 * 从请求头中提取客户端浏览器/设备信息。
 *
 * @param {Request | undefined} req - HTTP 请求对象
 * @returns {string} User-Agent 字符串，未知时返回空字符串
 */
function getUserAgent(req?: Request): string {
  if (!req) return "";
  return req.headers.get("user-agent") || "";
}

/**
 * 记录管理员操作审计日志
 *
 * 将管理员的操作记录到审计日志系统。
 * 此函数设计为非阻塞：即使日志写入失败也不会影响主业务逻辑。
 *
 * @param {AdminAuditPayload} payload - 审计日志载荷
 * @returns {Promise<void>} 日志写入完成后的 Promise
 *
 * @example
 * await recordAdminAudit({
 *   actor: 'admin',
 *   action: 'delete_post',
 *   targetType: 'post',
 *   targetId: '123',
 *   detail: { reason: '违规内容' },
 *   req
 * });
 */
export async function recordAdminAudit(payload: AdminAuditPayload): Promise<void> {
  try {
    await auditLogRepository.createAdminLog({
      actor: payload.actor,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId || "",
      detailJson: JSON.stringify(payload.detail || {}),
      ipAddress: getClientIp(payload.req),
      userAgent: getUserAgent(payload.req),
    });
  } catch (error) {
    // Audit failures should not break admin operations.
    console.error("[admin-audit] failed to write log", error);
  }
}
