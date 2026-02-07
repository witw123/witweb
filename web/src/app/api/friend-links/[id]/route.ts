import { getBlogDb } from "@/lib/db";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { detectFriendLinkIcon } from "@/lib/friend-link-icon";
import { initDb } from "@/lib/db-init";
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

  const db = getBlogDb();
  let finalAvatarUrl = body.avatar_url || null;
  if (!finalAvatarUrl && body.url) {
    finalAvatarUrl = await detectFriendLinkIcon(body.url);
  }

  db.prepare(`
    UPDATE friend_links
    SET name = ?, url = ?, description = ?, avatar_url = ?,
        sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    body.name,
    body.url,
    body.description || null,
    finalAvatarUrl,
    body.sort_order ?? 0,
    body.is_active ?? 1,
    id
  );

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
  const db = getBlogDb();
  db.prepare("DELETE FROM friend_links WHERE id = ?").run(id);

  return successResponse({ message: "Friend link deleted successfully" });
});
