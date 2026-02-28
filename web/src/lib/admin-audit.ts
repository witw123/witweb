import { auditLogRepository } from "@/lib/repositories";

export type AdminAuditTargetType = "user" | "post" | "category" | "security" | "friend_link" | "system";

export interface AdminAuditPayload {
  actor: string;
  action: string;
  targetType: AdminAuditTargetType;
  targetId?: string;
  detail?: Record<string, unknown>;
  req?: Request;
}

function getClientIp(req?: Request): string {
  if (!req) return "";
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return req.headers.get("x-real-ip") || "";
}

function getUserAgent(req?: Request): string {
  if (!req) return "";
  return req.headers.get("user-agent") || "";
}

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
