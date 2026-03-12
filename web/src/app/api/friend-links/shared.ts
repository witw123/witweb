/**
 * Friend Links API - 友链管理数据处理
 *
 * 提供友链的 CRUD 操作：
 * GET - 获取友链列表（管理员可见全部，普通用户仅可见已激活的）
 * POST - 创建新友链
 * PUT - 更新友链信息
 * DELETE - 删除友链
 * 所有修改操作需要管理员权限
 */

import { recordAdminAudit } from "@/lib/admin-audit";
import { createdResponse, successResponse } from "@/lib/api-response";
import { detectFriendLinkIcon } from "@/lib/friend-link-icon";
import { getAuthIdentity } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { hasAdminPermission } from "@/lib/rbac";
import { validateBody, validateParams, z } from "@/lib/validate";
import { assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";

const friendLinkSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  url: z.string().min(1, "URL is required").url("Invalid URL"),
  description: z.string().max(500, "Description is too long").optional().default(""),
  avatar_url: z.union([z.string().url("Invalid avatar URL"), z.literal("")]).optional().nullable().default(null),
  sort_order: z.coerce.number().int().default(0),
});

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  url: z.string().trim().url("Invalid URL"),
  description: z.string().trim().max(500).optional().nullable(),
  avatar_url: z.string().trim().url("Invalid avatar URL").optional().nullable().or(z.literal("")),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
});

/**
 * 构建友链列表 GET 响应
 *
 * 获取所有友链，管理员返回全部，普通用户仅返回已激活的友链
 *
 * @returns {Promise<Response>} 友链列表响应
 */
export async function buildFriendLinksGetResponse(): Promise<Response> {
  const auth = await getAuthIdentity();
  const canManage = !!auth && hasAdminPermission(auth.role, "friends.manage");
  const links = await postRepository.listFriendLinks(canManage);

  return successResponse({ links });
}

/**
 * 构建友链 POST 响应
 *
 * 创建新的友链，自动检测网站图标，记录管理员操作日志
 *
 * @param {Request} req - HTTP 请求对象，包含友链数据
 * @returns {Promise<Response>} 创建结果响应
 */
export async function buildFriendLinksPostResponse(req: Request): Promise<Response> {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "friends.manage"), "Forbidden");

  const body = await validateBody(req, friendLinkSchema);

  let finalAvatarUrl = body.avatar_url || null;
  if (!finalAvatarUrl) finalAvatarUrl = await detectFriendLinkIcon(body.url);

  const id = await postRepository.createFriendLink({
    name: body.name,
    url: body.url,
    description: body.description || "",
    avatar_url: finalAvatarUrl || "",
    sort_order: body.sort_order,
    is_active: true,
  });

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.friend_link.create",
    targetType: "friend_link",
    targetId: String(id),
    detail: {
      name: body.name,
      url: body.url,
    },
    req,
  });

  return createdResponse({
    id,
    message: "Friend link created successfully",
  });
}

/**
 * 构建友链 PUT 响应
 *
 * 更新指定 ID 的友链信息，需要管理员权限
 *
 * @param {Request} request - HTTP 请求对象，包含更新数据
 * @param {Promise<{ id: string }>} params - URL 参数，包含友链 ID
 * @returns {Promise<Response>} 更新结果响应
 */
export async function buildFriendLinkPutResponse(
  request: Request,
  params: Promise<{ id: string }>
): Promise<Response> {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "friends.manage"), "Forbidden");

  const { id } = validateParams(await params, paramsSchema);
  const body = await validateBody(request, updateSchema);

  let finalAvatarUrl = body.avatar_url || null;
  if (!finalAvatarUrl && body.url) finalAvatarUrl = await detectFriendLinkIcon(body.url);

  await postRepository.updateFriendLink(id, {
    name: body.name,
    url: body.url,
    description: body.description || "",
    avatar_url: finalAvatarUrl || "",
    sort_order: body.sort_order ?? 0,
    is_active: (body.is_active ?? 1) === 1,
  });

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.friend_link.update",
    targetType: "friend_link",
    targetId: String(id),
    detail: {
      name: body.name,
      url: body.url,
      is_active: (body.is_active ?? 1) === 1,
    },
    req: request,
  });

  return successResponse({ message: "Friend link updated successfully" });
}

/**
 * 构建友链 DELETE 响应
 *
 * 删除指定 ID 的友链，需要管理员权限
 *
 * @param {Request} request - HTTP 请求对象
 * @param {Promise<{ id: string }>} params - URL 参数，包含友链 ID
 * @returns {Promise<Response>} 删除结果响应
 */
export async function buildFriendLinkDeleteResponse(
  request: Request,
  params: Promise<{ id: string }>
): Promise<Response> {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "friends.manage"), "Forbidden");

  const { id } = validateParams(await params, paramsSchema);
  await postRepository.deleteFriendLink(id);

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.friend_link.delete",
    targetType: "friend_link",
    targetId: String(id),
    req: request,
  });

  return successResponse({ message: "Friend link deleted successfully" });
}
