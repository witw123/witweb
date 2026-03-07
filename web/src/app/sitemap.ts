import type { MetadataRoute } from "next";
import { drizzlePostRepository } from "@/lib/repositories";
import { getSiteUrl } from "@/lib/site-url";

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
      lastModified: new Date(post.updated_at || post.created_at || now),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...postRoutes];
  } catch {
    return staticRoutes;
  }
}
