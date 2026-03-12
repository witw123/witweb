/**
 * Admin Stats v1 版本 API
 *
 * v1 版本的统计接口，重新导出 v2 版本的实现
 * 后续可能在此版本添加版本特定的逻辑
 *
 * @route /api/v1/admin/stats
 * @method GET - 获取统计数据
 */
export { GET } from "../../../admin/stats/route";
