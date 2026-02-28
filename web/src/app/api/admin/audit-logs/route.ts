import { getAuthIdentity } from "@/lib/http";
import { auditLogRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";
import { hasAdminPermission } from "@/lib/rbac";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  actor: z.string().default(""),
  action: z.string().default(""),
  target_type: z.string().default(""),
});

const actionLabels: Record<string, string> = {
  "admin.user.delete": "删除用户",
  "admin.user.batch_delete": "批量删除用户",
  "admin.user.update_role": "修改用户角色",
  "admin.post.update": "更新文章",
  "admin.post.soft_delete": "删除文章（回收站）",
  "admin.post.hard_delete": "永久删除文章",
  "admin.post.batch_soft_delete": "批量删除文章（回收站）",
  "admin.post.batch_hard_delete": "批量永久删除文章",
  "admin.post.batch_update_status": "批量修改文章状态",
  "admin.category.create": "创建分类",
  "admin.category.update": "更新分类",
  "admin.category.delete": "删除分类",
  "admin.category.reorder": "调整分类排序",
  "admin.security.set_config": "更新安全配置",
  "admin.security.clear_cache": "清理配置缓存",
  "admin.friend_link.create": "创建友链",
  "admin.friend_link.update": "更新友链",
  "admin.friend_link.delete": "删除友链",
};

const targetTypeLabels: Record<string, string> = {
  user: "用户",
  post: "文章",
  category: "分类",
  security: "安全配置",
  friend_link: "友链",
  system: "系统",
};

function safeParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function summarize(action: string, targetType: string, targetId: string, detailJson: string): string {
  const detail = safeParse(detailJson);
  if (action === "admin.user.update_role") {
    const from = String(detail.from || "");
    const to = String(detail.to || "");
    return `将用户角色从 ${from || "未知"} 调整为 ${to || "未知"}`;
  }
  if (action.includes("batch") && Array.isArray(detail.ids)) {
    return `批量操作 ${detail.ids.length} 条${targetTypeLabels[targetType] || "记录"}`;
  }
  if (action === "admin.security.set_config") {
    return `更新配置项 ${String(detail.key || targetId || "未知")}`;
  }
  if (targetId) return `目标：${targetTypeLabels[targetType] || targetType} #${targetId}`;
  return "执行管理操作";
}

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "audit.read"), "需要审计日志查看权限");

  const { page, size, actor, action, target_type: targetType } = await validateQuery(req, querySchema);
  const result = await auditLogRepository.listAdminLogs({
    page,
    size,
    actor,
    action,
    targetType,
  });

  const items = result.items.map((item) => ({
    ...item,
    action_label: actionLabels[item.action] || item.action,
    target_type_label: targetTypeLabels[item.target_type] || item.target_type,
    summary: summarize(item.action, item.target_type, item.target_id, item.detail_json),
  }));

  return paginatedResponse(items, result.total, page ?? 1, size ?? 20);
});

