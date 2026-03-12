/**
 * 视频配置管理
 *
 * 获取和更新视频生成的相关配置
 *
 * @route /api/v1/video/config
 * @method GET - 获取视频配置
 * @method POST - 更新视频配置
 * @returns {Promise<Object>} 配置信息
 */
export { GET, POST } from "../../../video/config/route";
