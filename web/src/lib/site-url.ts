/**
 * 站点 URL 工具
 *
 * 统一解析站点根地址，供 sitemap、robots、分享链接和服务端拼接绝对 URL 使用。
 * 解析优先级固定为 `NEXT_PUBLIC_SITE_URL > APP_URL > localhost:3000`，
 * 避免不同模块各自读取环境变量导致线上域名不一致。
 */

/**
 * 获取当前站点 URL
 *
 * 从环境变量中读取站点 URL，支持多种配置方式：
 * - NEXT_PUBLIC_SITE_URL: 生产环境推荐使用
 * - APP_URL: 备用选项
 * - localhost:3000: 开发环境默认值
 *
 * @returns {string} 规范化的站点 URL（去除尾部斜杠）
 *
 * @example
 * const siteUrl = getSiteUrl();
 * // 生产环境: "https://example.com"
 * // 开发环境: "http://localhost:3000"
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";

  // 去掉尾部斜杠，保证后续路径拼接不会出现 `//post/...`。
  return raw.replace(/\/+$/, "");
}
