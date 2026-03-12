/**
 * Admin Stats 趋势数据 API
 *
 * v1 版本的统计趋势接口
 * 重新调用主路由的 trends 视图
 * 支持 days 查询参数指定查询天数
 *
 * @route /api/v1/admin/stats/trends
 * @method GET - 获取统计趋势数据
 * @query {number} [days] - 查询天数，默认7天，最大30天
 */
import { GET as getStats } from "../route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = url.searchParams.get("days") ?? "7";
  return getStats(
    new Request(`http://localhost/api/v1/admin/stats?view=trends&days=${days}`) as never,
    { params: Promise.resolve({}) }
  );
}
