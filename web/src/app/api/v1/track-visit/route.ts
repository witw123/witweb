/**
 * 访问追踪 API
 *
 * 记录站点访问事件，供后台统计和流量分析使用。
 *
 * @route /api/v1/track-visit
 * @method POST - 记录访问
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { buildTrackVisitResponse } from "../../track-visit/shared";

export const POST = withErrorHandler(async (request: Request) => buildTrackVisitResponse(request));
