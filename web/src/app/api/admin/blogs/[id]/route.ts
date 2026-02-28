import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

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

