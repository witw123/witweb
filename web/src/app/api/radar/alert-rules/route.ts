import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { createRadarAlertRule, listRadarAlertRules } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  rule_type: z.enum(["new_item", "keyword", "source", "min_score"]),
  keyword: z.string().trim().max(80).optional(),
  source_id: z.coerce.number().int().positive().optional(),
  min_score: z.coerce.number().min(0).max(220).optional(),
  channel_id: z.coerce.number().int().positive(),
  enabled: z.boolean().optional(),
});

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  return successResponse({ items: await listRadarAlertRules(user) });
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);

  const created = await createRadarAlertRule({
    username: user,
    name: body.name,
    ruleType: body.rule_type,
    keyword: body.keyword,
    sourceId: body.source_id,
    minScore: body.min_score,
    channelId: body.channel_id,
    enabled: body.enabled,
  });

  return successResponse(created);
});
