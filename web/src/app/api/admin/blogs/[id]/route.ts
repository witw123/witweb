/**
 * Admin Blog 管理 API
 *
 * 提供博客文章的查看、更新和删除功能
 * 支持软删除和硬删除两种方式
 *
 * @route /api/admin/blogs/[id]
 * @method GET - 获取博客详情（管理员视图）
 * @method PUT - 更新博客内容或状态
 * @method DELETE - 删除博客（支持软删除和硬删除）
 */
import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

/** URL 参数验证 Schema - 博客 ID */
const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** 更新博客请求体验证 Schema */
const updateSchema = z.object({
  status: z.enum(["published", "draft", "deleted"]).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.string().optional(),
  category_id: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "blogs.manage"), "需要文章管理权限");

  const { id } = validateParams(await params, paramsSchema);
  const blog = await postRepository.getAdminBlogDetail(id);
  if (!blog) return errorResponses.notFound("Blog not found");

  return successResponse(blog);
});

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "blogs.manage"), "需要文章管理权限");

  const { id } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updateSchema);

  const updated = await postRepository.updateById(id, {
    status: body.status,
    title: body.title,
    content: body.content,
    tags: body.tags,
    category_id: body.category_id,
  });
  if (!updated) return errorResponses.notFound("Blog not found");

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.post.update",
    targetType: "post",
    targetId: String(id),
    detail: {
      changed: Object.keys(body),
      status: body.status,
      category_id: body.category_id ?? null,
    },
    req,
  });

  return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "blogs.manage"), "需要文章管理权限");

  const { id } = validateParams(await params, paramsSchema);
  const hardDelete = new URL(req.url).searchParams.get("hard") === "1";
  const deleted = hardDelete
    ? await postRepository.hardDeleteById(id)
    : await postRepository.softDeleteById(id);
  if (!deleted) return errorResponses.notFound("Blog not found");

  await recordAdminAudit({
    actor: auth.username,
    action: hardDelete ? "admin.post.hard_delete" : "admin.post.soft_delete",
    targetType: "post",
    targetId: String(id),
    req,
  });

  return successResponse({ ok: true });
});

