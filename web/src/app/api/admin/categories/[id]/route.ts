/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { deleteCategory, updateCategory } from "@/lib/admin";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses, noContentResponse } from "@/lib/api-response";
import { validateParams, validateBody, z } from "@/lib/validate";
import { isAdminUser } from "@/lib/http";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("分类ID必须是正整数"),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(100).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
});

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const paramsData = await params;
  initDb();
  
  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");
  
  const { id } = validateParams(paramsData, paramsSchema);
  const body = await validateBody(req, updateCategorySchema);
  
  const payload: Record<string, unknown> = {};
  const nextName = body.name !== undefined ? body.name.trim() : undefined;
  if (nextName !== undefined) {
    if (!nextName) {
      return errorResponses.badRequest("分类名称不能为空");
    }
    payload.name = nextName;
  }

  if (body.slug !== undefined) {
    const rawSlug = body.slug.trim();
    // 兼容历史数据：传空 slug 时回退到 name 生成，避免旧分类无法修改
    const fallbackName = nextName || "";
    const normalizedSlug = slugify(rawSlug || fallbackName);
    if (!normalizedSlug) {
      return errorResponses.badRequest("分类别名不能为空");
    }
    payload.slug = normalizedSlug;
  }

  if (body.description !== undefined) payload.description = body.description;
  if (body.is_active !== undefined) payload.is_active = body.is_active === 0 || body.is_active === false ? 0 : 1;

  if (Object.keys(payload).length === 0) {
    return errorResponses.badRequest("没有可更新的字段");
  }
  
  try {
    updateCategory(id, payload);
    return successResponse({ updated: true });
  } catch (error: any) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return errorResponses.conflict("分类名称或别名已存在");
    }
    throw error;
  }
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  const paramsData = await params;
  initDb();
  
  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");
  
  const { id } = validateParams(paramsData, paramsSchema);
  deleteCategory(id);
  
  return noContentResponse();
});

