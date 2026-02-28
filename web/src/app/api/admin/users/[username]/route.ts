import { getAuthIdentity } from "@/lib/http";
import { postRepository, userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { canAssignUserRole, hasAdminPermission, normalizeRole } from "@/lib/rbac";
import { authConfig } from "@/lib/config";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

const updateRoleSchema = z.object({
  role: z.enum(["super_admin", "admin", "content_reviewer", "operator", "user", "bot"]),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "users.manage"), "需要用户管理权限");

  const { username } = validateParams(await params, paramsSchema);
  const profile = await userRepository.findByUsername(username);
  if (!profile) return errorResponses.notFound("User not found");

  const detail = {
    username: profile.username,
    created_at: profile.created_at,
    role: normalizeRole(profile.role, profile.username === authConfig.adminUsername),
    status: "active",
    last_login: null,
    blog_count: await postRepository.getPostCountByAuthor(username),
  };

  return successResponse(detail);
});

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ username: string }> }) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "users.manage"), "需要用户管理权限");

  const { username } = validateParams(await params, paramsSchema);
  const target = await userRepository.findByUsername(username);
  if (!target) return errorResponses.notFound("User not found");

  const targetRole = normalizeRole(target.role, target.username === authConfig.adminUsername);
  if (targetRole === "super_admin" || targetRole === "admin") {
    return errorResponses.forbidden("Cannot delete admin");
  }

  const deleted = await userRepository.deleteByUsername(username);
  if (!deleted) return errorResponses.notFound("User not found");

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.user.delete",
    targetType: "user",
    targetId: username,
    detail: { role: target.role || "user" },
    req,
  });

  return successResponse({ ok: true });
});

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ username: string }> }) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "users.manage"), "需要用户管理权限");

  const { username } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updateRoleSchema);

  if (username === auth.username) {
    return errorResponses.forbidden("Cannot change your own role");
  }

  const target = await userRepository.findByUsername(username);
  if (!target) return errorResponses.notFound("User not found");

  const targetRole = normalizeRole(target.role, target.username === authConfig.adminUsername);
  const nextRole = normalizeRole(body.role);
  if (!canAssignUserRole(auth.role, targetRole, nextRole)) {
    return errorResponses.forbidden("No permission to assign this role");
  }

  const updated = await userRepository.updateRole(username, body.role);
  if (!updated) return errorResponses.notFound("User not found");

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.user.update_role",
    targetType: "user",
    targetId: username,
    detail: {
      from: targetRole,
      to: nextRole,
    },
    req,
  });

  return successResponse({
    ok: true,
    username,
    role: nextRole,
  });
});

