import { getAuthIdentity } from "@/lib/http";
import { userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { errorResponses, paginatedResponse, successResponse } from "@/lib/api-response";
import { validateBody, validateQuery, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().default(""),
  sort: z.enum(["created_at_desc", "created_at_asc", "username_asc", "username_desc", "role_asc", "role_desc"]).default("created_at_desc"),
  role: z.enum(["", "super_admin", "content_reviewer", "operator", "admin", "user", "bot"]).default(""),
  activity: z.enum(["", "active", "inactive"]).default(""),
});

const batchActionSchema = z.object({
  action: z.literal("delete"),
  usernames: z.array(z.string().trim().min(1).max(64)).min(1).max(200),
});

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "users.manage"), "需要用户管理权限");

  const { page, limit, search, sort, role, activity } = await validateQuery(req, querySchema);
  const result = await userRepository.listAdmin(page, limit, search, sort, role, activity);

  return paginatedResponse(result.items, result.total, page ?? 1, limit ?? 20);
});

export const POST = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "users.manage"), "需要用户管理权限");

  const body = await validateBody(req, batchActionSchema);
  if (body.action !== "delete") return errorResponses.badRequest("Unsupported action");

  const deleted = await userRepository.bulkDeleteByUsernames(body.usernames, [auth.username]);

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.user.batch_delete",
    targetType: "user",
    targetId: "batch",
    detail: {
      usernames: body.usernames,
      deleted,
    },
    req,
  });

  return successResponse({
    ok: true,
    deleted,
    requested: body.usernames.length,
  });
});

