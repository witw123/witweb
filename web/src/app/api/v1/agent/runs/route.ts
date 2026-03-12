/**
 * Agent 运行管理 API
 *
 * 创建和获取 Agent 运行列表
 *
 * @route /api/v1/agent/runs
 * @method GET - 获取运行列表
 * @method POST - 创建新运行
 */

import { createRun, listRuns } from "@/lib/agent";
import { AGENT_MODELS } from "@/lib/agent-llm";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, validateQuery, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

/** 请求体验证 Schema */
const bodySchema = z.object({
  agent_type: z.enum(["topic", "writing", "publish"]),
  model: z.enum(AGENT_MODELS).default("gemini-3-pro"),
  goal: z.string().trim().min(3, "Goal must be at least 3 characters"),
  assistant_name: z.string().trim().max(40).optional(),
  custom_system_prompt: z.string().trim().max(4000).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { page, size } = await validateQuery(req, querySchema);
  const result = await listRuns(user, page ?? 1, size ?? 20);

  return successResponse(result);
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const model = body.model ?? "gemini-3-pro";
  const result = await createRun(user, body.goal, body.agent_type, model, {
    assistantName: body.assistant_name,
    customSystemPrompt: body.custom_system_prompt,
  });

  return successResponse({
    run_id: result.runId,
    status: result.status,
  });
});
