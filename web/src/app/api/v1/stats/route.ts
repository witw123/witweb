/**
 * 网站统计信息 API
 *
 * 返回公开站点统计数据，供首页、关于页或公开看板展示。
 *
 * @route /api/v1/stats
 * @method GET - 获取站点统计
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { buildSiteStatsResponse } from "../../stats/shared";

export const GET = withErrorHandler(async () => buildSiteStatsResponse());
