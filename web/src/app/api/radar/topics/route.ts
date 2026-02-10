import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, validateQuery, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { createRadarSavedTopic, listRadarSavedTopics } from "@/lib/topic-radar";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  q: z.string().trim().optional(),
  kind: z.enum(["item", "analysis"]).optional(),
});

const bodySchema = z.object({
  kind: z.enum(["item", "analysis"]).default("item"),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(2000).optional(),
  content: z.string().trim().max(20000).optional(),
  source_name: z.string().trim().max(120).optional(),
  source_url: z.string().trim().url().optional(),
  score: z.coerce.number().min(0).max(220).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

export const GET = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const query = await validateQuery(req, querySchema);

  const items = listRadarSavedTopics(user, {
    limit: query.limit,
    q: query.q,
    kind: query.kind,
  });
  return successResponse({ items });
});

export const POST = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);

  const created = createRadarSavedTopic({
    username: user,
    kind: body.kind ?? "item",
    title: body.title,
    summary: body.summary,
    content: body.content,
    sourceName: body.source_name,
    sourceUrl: body.source_url,
    score: body.score,
    tags: body.tags,
  });

  return successResponse({ id: created.id });
});
