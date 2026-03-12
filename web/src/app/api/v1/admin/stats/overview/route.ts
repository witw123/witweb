/**
 * Admin Stats 概览数据 API
 *
 * v1 版本的统计概览接口
 * 重新调用主路由的 overview 视图
 *
 * @route /api/v1/admin/stats/overview
 * @method GET - 获取统计概览数据
 */
import { GET as getStats } from "../route";

export async function GET() {
  return getStats(
    new Request("http://localhost/api/v1/admin/stats?view=overview") as never,
    { params: Promise.resolve({}) }
  );
}
