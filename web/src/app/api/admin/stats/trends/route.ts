import { getAuthIdentity } from "@/lib/http";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import { pgQuery } from "@/lib/postgres-query";
import { hasAdminPermission } from "@/lib/rbac";

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(30).default(7),
});

type DayCountRow = {
  day: string;
  cnt: number;
};

function toMap(rows: DayCountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.day, Number(row.cnt || 0)]));
}

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "dashboard.view"), "需要仪表盘查看权限");

  const { days } = await validateQuery(req, querySchema);
  const span = Math.max(7, Math.min(30, days ?? 7));

  const [dateRows, userRows, postRows, messageRows, activeRows] = await Promise.all([
    pgQuery<{ day: string }>(
      `
        SELECT to_char(d::date, 'YYYY-MM-DD') AS day
        FROM generate_series(
          CURRENT_DATE - (?::int - 1) * interval '1 day',
          CURRENT_DATE,
          interval '1 day'
        ) AS d
        ORDER BY d ASC
      `,
      [span]
    ),
    pgQuery<DayCountRow>(
      `
        SELECT to_char((created_at::timestamptz)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
        FROM users
        WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
        GROUP BY (created_at::timestamptz)::date
      `,
      [span]
    ),
    pgQuery<DayCountRow>(
      `
        SELECT to_char((created_at::timestamptz)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
        FROM posts
        WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
        GROUP BY (created_at::timestamptz)::date
      `,
      [span]
    ),
    pgQuery<DayCountRow>(
      `
        SELECT to_char((created_at::timestamptz)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
        FROM private_messages
        WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
        GROUP BY (created_at::timestamptz)::date
      `,
      [span]
    ),
    pgQuery<DayCountRow>(
      `
        SELECT to_char(t.day, 'YYYY-MM-DD') AS day, COUNT(DISTINCT t.username)::int AS cnt
        FROM (
          SELECT (created_at::timestamptz)::date AS day, author AS username
          FROM posts
          WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
          UNION ALL
          SELECT (created_at::timestamptz)::date AS day, author AS username
          FROM comments
          WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
          UNION ALL
          SELECT (created_at::timestamptz)::date AS day, username
          FROM likes
          WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
          UNION ALL
          SELECT (created_at::timestamptz)::date AS day, sender AS username
          FROM private_messages
          WHERE created_at::timestamptz >= CURRENT_DATE - (?::int - 1) * interval '1 day'
        ) t
        GROUP BY t.day
      `,
      [span, span, span, span]
    ),
  ]);

  const userMap = toMap(userRows);
  const postMap = toMap(postRows);
  const messageMap = toMap(messageRows);
  const activeMap = toMap(activeRows);

  const items = dateRows.map((row) => ({
    day: row.day,
    new_users: userMap.get(row.day) || 0,
    new_posts: postMap.get(row.day) || 0,
    active_users: activeMap.get(row.day) || 0,
    messages: messageMap.get(row.day) || 0,
  }));

  const totals = items.reduce(
    (acc, item) => ({
      new_users: acc.new_users + item.new_users,
      new_posts: acc.new_posts + item.new_posts,
      active_users: acc.active_users + item.active_users,
      messages: acc.messages + item.messages,
    }),
    { new_users: 0, new_posts: 0, active_users: 0, messages: 0 }
  );

  return successResponse({ days: span, items, totals });
});
