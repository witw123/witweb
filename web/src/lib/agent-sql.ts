import "server-only";

import { pgQuery } from "@/lib/postgres-query";

type SqlIntent = "top_posts_30d" | "top_categories_by_favorites" | "video_success_rate_7d";

function inferIntent(question: string): SqlIntent {
  const normalized = question.toLowerCase();

  if (normalized.includes("视频") || normalized.includes("video")) {
    return "video_success_rate_7d";
  }
  if (normalized.includes("分类") && (normalized.includes("收藏") || normalized.includes("favorite"))) {
    return "top_categories_by_favorites";
  }
  return "top_posts_30d";
}

function buildSql(intent: SqlIntent) {
  switch (intent) {
    case "top_categories_by_favorites":
      return {
        intent,
        sql: `
          SELECT
            c.name AS category_name,
            c.slug AS category_slug,
            COUNT(f.id)::int AS favorite_count
          FROM favorites f
          INNER JOIN posts p ON p.id = f.post_id
          LEFT JOIN categories c ON c.id = p.category_id
          GROUP BY c.name, c.slug
          ORDER BY favorite_count DESC, category_name ASC
          LIMIT 10
        `,
        summary: "按收藏数统计最受欢迎的分类。",
      };
    case "video_success_rate_7d":
      return {
        intent,
        sql: `
          SELECT
            COUNT(*)::int AS total_tasks,
            COUNT(*) FILTER (WHERE status = 'done')::int AS done_tasks,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_tasks,
            ROUND(
              CASE WHEN COUNT(*) = 0 THEN 0
              ELSE (COUNT(*) FILTER (WHERE status = 'done')::numeric / COUNT(*)::numeric) * 100
              END,
              2
            ) AS success_rate
          FROM video_tasks
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `,
        summary: "统计最近 7 天视频任务成功率。",
      };
    default:
      return {
        intent,
        sql: `
          SELECT
            p.title,
            p.slug,
            p.author,
            COALESCE(p.view_count, 0) AS view_count,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
            (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id) AS favorite_count
          FROM posts p
          WHERE p.created_at >= NOW() - INTERVAL '30 days'
            AND p.status != 'deleted'
          ORDER BY favorite_count DESC, like_count DESC, view_count DESC
          LIMIT 10
        `,
        summary: "统计最近 30 天表现最好的文章。",
      };
  }
}

export async function executeNaturalLanguageSql(question: string) {
  const intent = inferIntent(question);
  const { sql, summary } = buildSql(intent);
  const rows = await pgQuery<Record<string, unknown>>(sql);

  return {
    intent,
    sql: sql.trim(),
    summary,
    rows,
    safe_mode: "whitelist_only",
  };
}
