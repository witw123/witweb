import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { errorResponses, paginatedResponse, successResponse } from "@/lib/api-response";
import { validateBody, validateQuery, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().default(""),
  status: z.string().default(""),
  username: z.string().default(""),
  tag: z.string().default(""),
  date_from: z.string().default(""),
  date_to: z.string().default(""),
  sort: z.string().default("created_at_desc"),
});

const batchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("publish"),
    ids: z.array(z.number().int().positive()).min(1).max(200),
  }),
  z.object({
    action: z.literal("draft"),
    ids: z.array(z.number().int().positive()).min(1).max(200),
  }),
  z.object({
    action: z.literal("delete"),
    ids: z.array(z.number().int().positive()).min(1).max(200),
  }),
  z.object({
    action: z.literal("restore"),
    ids: z.array(z.number().int().positive()).min(1).max(200),
  }),
  z.object({
    action: z.literal("destroy"),
    ids: z.array(z.number().int().positive()).min(1).max(200),
  }),
]);

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "blogs.manage"), "需要文章管理权限");

  const { page, limit, search, status, username, tag, date_from: dateFrom, date_to: dateTo, sort } =
    await validateQuery(req, querySchema);

  const result = await postRepository.listAdminBlogs({
    page,
    size: limit,
    search,
    status,
    username,
    tag,
    dateFrom,
    dateTo,
    sort,
  });

  return paginatedResponse(result.items, result.total, page ?? 1, limit ?? 20);
});

export const POST = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "blogs.manage"), "需要文章管理权限");

  const body = await validateBody(req, batchActionSchema);

  if (body.action === "publish" || body.action === "draft" || body.action === "restore") {
    const updated = await postRepository.bulkUpdateStatusByIds(
      body.ids,
      body.action === "publish" ? "published" : "draft"
    );

    await recordAdminAudit({
      actor: auth.username,
      action: "admin.post.batch_update_status",
      targetType: "post",
      targetId: "batch",
      detail: {
        ids: body.ids,
        status: body.action === "publish" ? "published" : "draft",
        updated,
      },
      req,
    });

    return successResponse({ ok: true, updated });
  }

  if (body.action === "delete") {
    const deleted = await postRepository.bulkUpdateStatusByIds(body.ids, "deleted");

    await recordAdminAudit({
      actor: auth.username,
      action: "admin.post.batch_soft_delete",
      targetType: "post",
      targetId: "batch",
      detail: {
        ids: body.ids,
        deleted,
      },
      req,
    });

    return successResponse({ ok: true, deleted });
  }

  if (body.action === "destroy") {
    const deleted = await postRepository.bulkDeleteByIds(body.ids);

    await recordAdminAudit({
      actor: auth.username,
      action: "admin.post.batch_hard_delete",
      targetType: "post",
      targetId: "batch",
      detail: {
        ids: body.ids,
        deleted,
      },
      req,
    });

    return successResponse({ ok: true, deleted });
  }

  return errorResponses.badRequest("Unsupported action");
});

