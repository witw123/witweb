import { NextRequest } from "next/server";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { getBlogDb } from "@/lib/db";
import { initDb } from "@/lib/db-init";

/**
 * GET /api/tags
 * 获取所有文章的标签统计
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  initDb();
  const db = getBlogDb();

  // 获取所有已发布文章的标签
  const posts = db
    .prepare(
      `SELECT tags FROM posts 
       WHERE status = 'published' 
       AND tags IS NOT NULL 
       AND tags != ''`
    )
    .all() as Array<{ tags: string }>;

  // 统计标签出现次数
  const tagCounter = new Map<string, number>();

  posts.forEach((post) => {
    const tags = post.tags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    tags.forEach((tag) => {
      tagCounter.set(tag, (tagCounter.get(tag) || 0) + 1);
    });
  });

  // 转换为数组并排序
  const tagList = Array.from(tagCounter.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return successResponse({
    tags: tagList,
    total: tagList.length,
  });
});
