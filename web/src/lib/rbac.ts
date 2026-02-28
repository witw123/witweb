export type AppRole =
  | "super_admin"
  | "content_reviewer"
  | "operator"
  | "admin"
  | "user"
  | "bot";

export type AdminPermission =
  | "dashboard.view"
  | "users.manage"
  | "blogs.manage"
  | "categories.manage"
  | "friends.manage"
  | "audit.read"
  | "security.manage";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "超级管理员",
  admin: "管理员",
  content_reviewer: "内容审核员",
  operator: "运营专员",
  user: "普通用户",
  bot: "机器人账号",
};

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  "dashboard.view": "查看仪表盘",
  "users.manage": "管理用户",
  "blogs.manage": "管理文章",
  "categories.manage": "管理分类",
  "friends.manage": "管理友链",
  "audit.read": "查看审计日志",
  "security.manage": "管理安全设置",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "拥有全站后台最高权限，可管理所有角色和安全配置。",
  admin: "站点管理员，负责日常运营管理，不可提升为超级管理员。",
  content_reviewer: "内容审核角色，主要处理文章相关内容管理。",
  operator: "运营角色，主要负责用户运营与审计查看。",
  user: "普通注册用户，仅可使用前台功能。",
  bot: "系统或自动化账号，用于任务执行与自动流程。",
};

const ADMIN_PERMISSIONS: Record<Exclude<AppRole, "user" | "bot">, AdminPermission[]> = {
  super_admin: [
    "dashboard.view",
    "users.manage",
    "blogs.manage",
    "categories.manage",
    "friends.manage",
    "audit.read",
    "security.manage",
  ],
  admin: [
    "dashboard.view",
    "users.manage",
    "blogs.manage",
    "categories.manage",
    "friends.manage",
    "audit.read",
    "security.manage",
  ],
  content_reviewer: ["dashboard.view", "blogs.manage"],
  operator: ["dashboard.view", "users.manage", "audit.read"],
};

export function normalizeRole(rawRole?: string | null, isLegacyAdmin = false): AppRole {
  if (isLegacyAdmin) return "super_admin";
  if (!rawRole) return "user";
  if (rawRole === "super_admin") return "super_admin";
  if (rawRole === "content_reviewer") return "content_reviewer";
  if (rawRole === "operator") return "operator";
  if (rawRole === "admin") return "admin";
  if (rawRole === "bot") return "bot";
  return "user";
}

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}

export function getPermissionLabel(permission: AdminPermission): string {
  return PERMISSION_LABELS[permission];
}

export function hasAdminAccess(role: AppRole): boolean {
  return role === "super_admin" || role === "admin" || role === "content_reviewer" || role === "operator";
}

export function hasAdminPermission(role: AppRole, permission: AdminPermission): boolean {
  if (!hasAdminAccess(role)) return false;
  return (ADMIN_PERMISSIONS[role as keyof typeof ADMIN_PERMISSIONS] || []).includes(permission);
}

export function listRolePermissions(role: AppRole): AdminPermission[] {
  if (!hasAdminAccess(role)) return [];
  return [...(ADMIN_PERMISSIONS[role as keyof typeof ADMIN_PERMISSIONS] || [])];
}

export function canAssignUserRole(actorRole: AppRole, targetRole: AppRole, nextRole: AppRole): boolean {
  if (actorRole === "super_admin") return true;

  if (actorRole === "admin") {
    if (targetRole === "super_admin" || targetRole === "admin") return false;
    return (
      nextRole === "content_reviewer" ||
      nextRole === "operator" ||
      nextRole === "user" ||
      nextRole === "bot"
    );
  }

  if (actorRole === "operator") {
    if (targetRole !== "user" && targetRole !== "bot") return false;
    return nextRole === "user" || nextRole === "bot";
  }

  return false;
}

