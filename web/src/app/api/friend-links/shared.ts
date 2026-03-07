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

export async function buildFriendLinksGetResponse(): Promise<Response> {
  const auth = await getAuthIdentity();
  const canManage = !!auth && hasAdminPermission(auth.role, "friends.manage");
  const links = await postRepository.listFriendLinks(canManage);

  return successResponse({ links });
}

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
