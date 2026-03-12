/**
 * Admin Category 管理 API - 单个分类操作
 *
 * 提供分类的更新和删除功能
 * 支持更新分类名称、别名、描述和激活状态
 *
 * @route /api/admin/categories/[id]
 * @method PUT - 更新分类信息
 * @method DELETE - 删除分类
 */
import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses, noContentResponse } from "@/lib/api-response";
import { validateParams, validateBody, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("分类ID必须是正整数"),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(100).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

type CategoryUpdatePayload = {
  name?: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
};

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const paramsData = await params;
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "categories.manage"), "需要分类管理权限");

  const { id } = validateParams(paramsData, paramsSchema);
  const body = await validateBody(req, updateCategorySchema);

  const payload: CategoryUpdatePayload = {};
  const nextName = body.name !== undefined ? body.name.trim() : undefined;
  if (nextName !== undefined) {
    if (!nextName) return errorResponses.badRequest("分类名称不能为空");
    payload.name = nextName;
  }

  if (body.slug !== undefined) {
    const rawSlug = body.slug.trim();
    const fallbackName = nextName || "";
    const normalizedSlug = slugify(rawSlug || fallbackName);
    if (!normalizedSlug) return errorResponses.badRequest("分类别名不能为空");
    payload.slug = normalizedSlug;
  }

  if (body.description !== undefined) payload.description = body.description;
  if (body.is_active !== undefined) payload.is_active = !(body.is_active === 0 || body.is_active === false);

  if (Object.keys(payload).length === 0) return errorResponses.badRequest("没有可更新字段");

  try {
    await postRepository.updateCategory(id, payload);

    await recordAdminAudit({
      actor: auth.username,
      action: "admin.category.update",
      targetType: "category",
      targetId: String(id),
      detail: payload,
      req,
    });

    return successResponse({ updated: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return errorResponses.conflict("分类名称或别名已存在");
    }
    throw error;
  }
});

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const paramsData = await params;
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "categories.manage"), "需要分类管理权限");

  const { id } = validateParams(paramsData, paramsSchema);
  await postRepository.deleteCategory(id);

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.category.delete",
    targetType: "category",
    targetId: String(id),
    req,
  });

  return noContentResponse();
});

