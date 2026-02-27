import { getAuthUser, isAdminUser } from "@/lib/http";
import { detectFriendLinkIcon } from "@/lib/friend-link-icon";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, createdResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const friendLinkSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称最多100字符"),
  url: z.string().min(1, "URL不能为空").url("URL格式不正确"),
  description: z.string().max(500, "描述最多500字符").optional().default(""),
  avatar_url: z.union([z.string().url("头像URL格式不正确"), z.literal("")]).optional().nullable().default(null),
  sort_order: z.coerce.number().int().default(0),
});

export const GET = withErrorHandler(async () => {

  const user = await getAuthUser();
  const isAdmin = !!user && isAdminUser(user);

  const links = await postRepository.listFriendLinks(isAdmin);

  return successResponse({ links });
});

export const POST = withErrorHandler(async (req) => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "只有管理员可以添加友链");

  const body = await validateBody(req, friendLinkSchema);

  let finalAvatarUrl = body.avatar_url || null;
  if (!finalAvatarUrl) {
    finalAvatarUrl = await detectFriendLinkIcon(body.url);
  }

  const id = await postRepository.createFriendLink({
    name: body.name,
    url: body.url,
    description: body.description || "",
    avatar_url: finalAvatarUrl || "",
    sort_order: body.sort_order,
    is_active: true,
  });

  return createdResponse({
    id,
    message: "友链添加成功",
  });
});
