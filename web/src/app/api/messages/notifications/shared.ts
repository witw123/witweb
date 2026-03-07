import { NextRequest } from "next/server";
import { commentRepository, drizzlePostRepository, userRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { errorResponses, paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";

const querySchema = z.object({
  type: z.enum(["replies", "likes", "at", "system"]).default("replies"),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

type SenderActivity = {
  sender: string;
  content?: string;
  created_at: string;
  post_title: string;
  post_slug: string;
};

type SenderActivityWithProfile = SenderActivity & {
  sender_nickname: string;
  sender_avatar: string;
};

async function enrichSender<T extends { sender: string }>(items: T[]) {
  const rows = await userRepository.listBasicByUsernames(items.map((item) => item.sender));
  const userMap = new Map(rows.map((row) => [row.username, row]));

  return items.map((item) => {
    const user = userMap.get(item.sender);
    return {
      ...item,
      sender_nickname: user?.nickname || item.sender,
      sender_avatar: user?.avatar_url || "",
    };
  });
}

export async function buildNotificationsResponse(req: NextRequest): Promise<Response> {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { type, page, size } = await validateQuery(req, querySchema);

  let items: SenderActivityWithProfile[] = [];
  let total = 0;

  if (type === "replies") {
    items = await enrichSender(await commentRepository.getRepliesToUser(user, page, size));
    total = items.length;
  } else if (type === "likes") {
    items = await enrichSender(await drizzlePostRepository.getLikesToUser(user, page, size));
    total = items.length;
  } else if (type === "at") {
    items = await enrichSender(await commentRepository.getMentionsToUser(user, page, size));
    total = items.length;
  } else if (type === "system") {
    const now = new Date().toISOString();
    items = [
      {
        sender: "system",
        sender_nickname: "系统通知",
        sender_avatar: "",
        content: `欢迎来到 witweb，${user}！在这里你可以分享你的故事。`,
        created_at: now,
        post_title: "站点公告",
        post_slug: "#",
      },
    ];
    total = items.length;
  }

  return paginatedResponse(items, total, page ?? 1, size ?? 20);
}
