/**
 * Admin Stats 统计主 API
 *
 * 根据 view 参数分发到不同的统计处理器
 * 支持获取概览数据和趋势数据
 *
 * @route /api/admin/stats
 * @method GET - 获取统计数据（通过 view 参数区分类型）
 * @query {string} view - 统计类型：overview（概览）或 trends（趋势）
 * @query {number} [days] - 趋势数据查询天数，默认7天，最大30天
 */
import { withErrorHandler } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import {
  getAdminStatsOverviewHandler,
  getAdminStatsTrendsHandler,
} from "./shared";

const statsQuerySchema = z.object({
  view: z.enum(["overview", "trends"]).default("overview"),
});

export const GET = withErrorHandler(async (req: Request) => {
  const { view } = await validateQuery(req, statsQuerySchema);

  if (view === "trends") {
    return getAdminStatsTrendsHandler(req);
  }

  return getAdminStatsOverviewHandler();
});
