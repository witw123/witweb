/**
 * Radar 数据分析 API
 *
 * 基于 Radar 采集的资讯内容，使用 LLM 生成智能分析摘要
 *
 * @route /api/v1/radar/analyze
 * @method POST - 生成资讯分析
 * @requiresAuth 需要用户认证
 */
import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { listRadarItems } from "@/lib/topic-radar";
import { generateRadarAnalysis } from "@/lib/agent-llm";

const bodySchema = z.object({
  limit: z.coerce.number().int().min(5).max(80).default(30),
  q: z.string().trim().optional(),
  source_id: z.coerce.number().int().positive().optional(),
  focus: z.string().trim().max(120).optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);
  const body = await validateBody(req, bodySchema);

  const items = await listRadarItems(user, {
    limit: body.limit,
    q: body.q,
    sourceId: body.source_id,
  });

  const analysis = await generateRadarAnalysis(
    items.map((item) => ({
      title: item.title,
      summary: item.summary,
      sourceName: item.source_name,
      url: item.url,
      score: item.score,
      publishedAt: item.published_at,
    })),
    {
      focus: body.focus,
    }
  );

  return successResponse({
    analysis,
    item_count: items.length,
  });
});
