/**
 * robots.txt 生成入口
 *
 * 明确告诉搜索引擎哪些页面可抓取、哪些后台与私有路径需要屏蔽，
 * 并暴露站点地图地址，降低重复抓取无关内容的概率。
 */
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/**
 * 生成 robots.txt 规则
 *
 * @returns {MetadataRoute.Robots} Next.js 识别的 robots 配置
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 后台、接口和强用户态页面不应被索引。
        disallow: ["/admin", "/api", "/messages", "/studio", "/agent", "/login", "/register"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
