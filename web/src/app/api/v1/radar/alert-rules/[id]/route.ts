/**
 * Radar 告警规则管理 API（单个）
 *
 * 更新或删除指定的告警规则
 *
 * @route /api/v1/radar/alert-rules/:id
 * @method PATCH - 更新告警规则
 * @method DELETE - 删除告警规则
 * @requiresAuth 需要用户认证
 */
import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse, errorResponses } from "@/lib/api-response";
import { deleteRadarAlertRule, updateRadarAlertRule } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  rule_type: z.enum(["new_item", "keyword", "source", "min_score"]).optional(),
  keyword: z.string().trim().max(80).optional(),
  source_id: z.coerce.number().int().positive().nullable().optional(),
  min_score: z.coerce.number().min(0).max(220).optional(),
  channel_id: z.coerce.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const { id } = await context.params;
  const ruleId = Number(id);
  const body = await validateBody(req, bodySchema);

  try {
    await updateRadarAlertRule(ruleId, user, {
      name: body.name,
      ruleType: body.rule_type,
      keyword: body.keyword,
      sourceId: body.source_id,
      minScore: body.min_score,
      channelId: body.channel_id,
      enabled: body.enabled,
    });
    return successResponse({ id: ruleId, updated: true });
  } catch (error) {
    if (error instanceof Error && error.message === "notification_not_found") {
      return errorResponses.notFound("notification_not_found");
    }
    return errorResponses.notFound("rule_not_found");
  }
});

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const { id } = await context.params;
  const ruleId = Number(id);

  try {
    await deleteRadarAlertRule(ruleId, user);
    return successResponse({ id: ruleId, deleted: true });
  } catch {
    return errorResponses.notFound("rule_not_found");
  }
});
