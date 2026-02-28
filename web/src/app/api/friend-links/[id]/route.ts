import { getAuthIdentity } from "@/lib/http";
import { detectFriendLinkIcon } from "@/lib/friend-link-icon";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, "名称不能为空").max(100, "名称最多100字符"),
  url: z.string().trim().url("URL格式不正确"),
  description: z.string().trim().max(500).optional().nullable(),
  avatar_url: z.string().trim().url("头像URL格式不正确").optional().nullable().or(z.literal("")),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
});

export const PUT = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "friends.manage"), "需要友链管理权限");

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
    is_active: body.is_active ?? 1,
  });

  await recordAdminAudit({
    actor: auth.username,
    action: "admin.friend_link.update",
    targetType: "friend_link",
    targetId: String(id),
    detail: {
      name: body.name,
      url: body.url,
      is_active: body.is_active ?? 1,
    },
    req: request,
  });

  return successResponse({ message: "Friend link updated successfully" });
});

export const DELETE = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "friends.manage"), "需要友链管理权限");

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
});

