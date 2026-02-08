import type { MetadataRoute } from "next";
import { initDb } from "@/lib/db-init";
import { getBlogDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site-url";

type PostSitemapRow = { slug: string; updated_at?: string | null; created_at?: string | null };

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/friends`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  try {
    initDb();
    const db = getBlogDb();

    const posts = db
      .prepare(
        `
          SELECT slug, updated_at, created_at
          FROM posts
          WHERE slug IS NOT NULL
            AND trim(slug) <> ''
            AND (status IS NULL OR status <> 'deleted')
          ORDER BY id DESC
        `
      )
      .all() as PostSitemapRow[];

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
