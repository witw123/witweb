/**
 * 友链列表 API
 *
 * 提供友链列表读取和友链创建入口。
 * 具体校验和权限约束由共享处理器统一处理，版本化路由只负责暴露稳定入口。
 *
 * @route /api/v1/friend-links
 * @method GET - 获取友链列表
 * @method POST - 创建新友链
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { buildFriendLinksGetResponse, buildFriendLinksPostResponse } from "../../friend-links/shared";

export const GET = withErrorHandler(async () => buildFriendLinksGetResponse());
export const POST = withErrorHandler(async (req) => buildFriendLinksPostResponse(req));
