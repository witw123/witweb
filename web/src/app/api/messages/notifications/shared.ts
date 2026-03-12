/**
 * Notifications API - 通知数据处理
 *
 * 提供获取用户通知的功能
 * 支持获取回复通知、点赞通知、@提及通知和系统通知
 * 需要用户登录后访问
 */

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

/**
 * 丰富发送者信息
 *
 * 根据发送者用户名列表获取用户资料，补充昵称和头像信息
 *
 * @template T - 包含 sender 字段的类型
 * @param {T[]} items - 需要丰富信息的通知列表
 * @returns {Promise<(T & { sender_nickname: string; sender_avatar: string })[]>} 丰富后的通知列表
 */
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

/**
 * 构建通知列表 GET 响应
 *
 * 获取当前用户的各类通知，包含回复、点赞、@提及和系统通知
 * 需要用户登录，返回分页数据
 *
 * @param {NextRequest} req - HTTP 请求对象，包含 type、page、size 查询参数
 * @returns {Promise<Response>} 通知列表响应
 */
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
