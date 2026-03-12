/**
 * 分类管理 API
 *
 * 管理员管理文章分类的接口，包括：
 * - 查询分类列表
 * - 创建新分类
 *
 * 需要分类管理权限
 *
 * @route /api/admin/categories
 * @method GET - 获取分类列表
 * @method POST - 创建新分类
 */
import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { errorResponses, paginatedResponse, createdResponse } from "@/lib/api-response";
import { validateQuery, validateBody, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  search: z.string().default(""),
});

const createCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(100, "分类名称最多100字符"),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).default(""),
  is_active: z.union([z.boolean(), z.number()]).default(1),
});

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 获取分类列表
 *
 * 管理员查询所有文章分类，支持搜索和分页
 *
 * @param {number} page - 页码，默认 1
 * @param {number} limit - 每页数量，默认 100
 * @param {string} search - 搜索关键词
 * @returns {Response} 分页的分类列表
 */
export const GET = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "categories.manage"), "需要分类管理权限");

  const { page, limit, search } = await validateQuery(req, querySchema);
  const result = await postRepository.listAdminCategories(page, limit, search);

  return paginatedResponse(result.items, result.total, page ?? 1, limit ?? 100);
});

/**
 * 创建新分类
 *
 * 创建一个新的文章分类，自动生成 slug 并记录审计日志
 *
 * @param {string} name - 分类名称，必填
 * @param {string} [slug] - 分类别名，可选
 * @param {string} [description] - 分类描述
 * @param {boolean} [is_active] - 是否激活，默认 true
 * @returns {Response} 包含新分类 ID 的响应
 */
export const POST = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "categories.manage"), "需要分类管理权限");

  const body = await validateBody(req, createCategorySchema);
  const slug = body.slug?.trim() || slugify(body.name);

  if (!slug) return errorResponses.badRequest("分类别名不能为空");

  try {
    const id = await postRepository.createCategory({
      name: body.name.trim(),
      slug,
      description: body.description,
      sort_order: await postRepository.getNextCategorySortOrder(),
      is_active: !(body.is_active === 0 || body.is_active === false),
    });

    await recordAdminAudit({
      actor: auth.username,
      action: "admin.category.create",
      targetType: "category",
      targetId: String(id),
      detail: {
        name: body.name.trim(),
        slug,
      },
      req,
    });

    return createdResponse({ id });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return errorResponses.conflict("分类名称或别名已存在");
    }
    throw error;
  }
});

