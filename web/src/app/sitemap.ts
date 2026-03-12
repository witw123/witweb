/**
 * 站点地图生成入口
 *
 * 聚合固定页面与已发布文章的 URL，供搜索引擎定期抓取。
 * 当文章查询失败时回退到静态路由，避免数据库瞬时异常导致整张站点地图不可用。
 */
import type { MetadataRoute } from "next";
import { drizzlePostRepository } from "@/lib/repositories";
import { getSiteUrl } from "@/lib/site-url";

/**
 * 生成 sitemap.xml 内容
 *
 * @returns {Promise<MetadataRoute.Sitemap>} 可供 Next.js 输出的站点地图数组
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/friends`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  try {
    const posts = await drizzlePostRepository.listSitemapPosts();

    const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${base}/post/${post.slug}`,
      // 文章更新时间缺失时回退到创建时间，再兜底为当前时间，保证字段始终可序列化。
      lastModified: new Date(post.updated_at || post.created_at || now),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...postRoutes];
  } catch {
    // 搜索引擎抓取时宁可返回退化结果，也不要直接失败。
    return staticRoutes;
  }
}
