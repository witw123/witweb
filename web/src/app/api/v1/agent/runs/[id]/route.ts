/**
 * Agent 运行记录管理 API（单个）
 *
 * 获取指定运行记录的详细状态，或删除指定的运行记录
 *
 * @route /api/v1/agent/runs/:id
 * @method GET - 获取运行详情
 * @method DELETE - 删除运行记录
 * @requiresAuth 需要用户认证
 */
import { deleteRun, getRunDetail } from "@/lib/agent";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const GET = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  try {
    const detail = await getRunDetail(id, user);
    return successResponse(detail);
  } catch {
    return errorResponses.notFound("task_not_found");
  }
});

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  try {
    const result = await deleteRun(id, user);
    return successResponse(result);
  } catch {
    return errorResponses.notFound("task_not_found");
  }
});
