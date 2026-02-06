import { initDb } from "@/lib/db-init";
import { getBlogDb } from "@/lib/db";
import { getAuthUser } from "@/lib/http";
import { detectFriendLinkIcon } from "@/lib/friend-link-icon";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, createdResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const adminUsername = process.env.ADMIN_USERNAME || process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

const friendLinkSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称最多100字符"),
  url: z.string().min(1, "URL不能为空").url("URL格式不正确"),
  description: z.string().max(500, "描述最多500字符").optional().default(""),
  avatar_url: z.union([z.string().url("头像URL格式不正确"), z.literal("")]).optional().nullable().default(null),
  sort_order: z.coerce.number().int().default(0),
});

export const GET = withErrorHandler(async () => {
  initDb();
  const db = getBlogDb();

  // 鑾峰彇褰撳墠鐢ㄦ埛锛堝彲閫夛級
  const user = await getAuthUser();
  const isAdmin = !!user && user === adminUsername;

  const links = db.prepare(`
    SELECT id, name, url, description, avatar_url, sort_order, is_active
    FROM friend_links
    ${isAdmin ? "" : "WHERE is_active = 1"}
    ORDER BY sort_order ASC, created_at DESC
  `).all();

  return successResponse({ links });
});

export const POST = withErrorHandler(async (req) => {
  initDb();

  // 楠岃瘉鐢ㄦ埛宸茬櫥褰曚笖鏄鐞嗗憳
  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(user === adminUsername, "只有管理员可以添加友链");

  // 楠岃瘉璇锋眰浣?
  const body = await validateBody(req, friendLinkSchema);

  const db = getBlogDb();

  let finalAvatarUrl = body.avatar_url || null;
  if (!finalAvatarUrl) {
    finalAvatarUrl = await detectFriendLinkIcon(body.url);
  }

  const result = db.prepare(`
    INSERT INTO friend_links (name, url, description, avatar_url, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    body.name,
    body.url,
    body.description || null,
    finalAvatarUrl,
    body.sort_order
  );

  return createdResponse({
    id: result.lastInsertRowid,
    message: "友链添加成功",
  });
});
