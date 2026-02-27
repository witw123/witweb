import { getAuthUser, isAdminUser } from "@/lib/http";
import { detectFriendLinkIcon } from "@/lib/friend-link-icon";
import { initDb } from "@/lib/db-init";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";

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
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { id } = validateParams(await params, paramsSchema);
  const body = await validateBody(request, updateSchema);

  let finalAvatarUrl = body.avatar_url || null;
  if (!finalAvatarUrl && body.url) {
    finalAvatarUrl = await detectFriendLinkIcon(body.url);
  }

  postRepository.updateFriendLink(id, {
    name: body.name,
    url: body.url,
    description: body.description || "",
    avatar_url: finalAvatarUrl || "",
    sort_order: body.sort_order ?? 0,
    is_active: body.is_active ?? 1,
  });

  return successResponse({ message: "Friend link updated successfully" });
});

export const DELETE = withErrorHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { id } = validateParams(await params, paramsSchema);
  postRepository.deleteFriendLink(id);

  return successResponse({ message: "Friend link deleted successfully" });
});
