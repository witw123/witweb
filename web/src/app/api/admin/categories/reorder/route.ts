/**
 * Admin Category 排序 API
 *
 * 批量更新分类的显示顺序
 * 根据传入的 ID 数组顺序设置分类权重
 *
 * @route /api/admin/categories/reorder
 * @method POST - 批量更新分类排序
 */
import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "ID 列表不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "categories.manage"), "需要分类管理权限");

  const body = await validateBody(req, reorderSchema);
  await postRepository.reorderCategories(body.ids);

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.category.reorder",
    targetType: "category",
    targetId: "batch",
    detail: { ids: body.ids },
    req,
  });

  return successResponse({ reordered: true });
});

