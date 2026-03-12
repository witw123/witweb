/**
 * 获取视频生成结果
 *
 * 从外部服务获取视频生成任务的实时结果
 *
 * @route /api/v1/video/result
 * @method POST - 获取视频生成结果
 * @param {string} id - 任务 ID
 * @returns {Promise<Object>} 视频生成结果
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { getResult } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const resultSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "Please log in first");

  const { id } = await validateBody(req, resultSchema);
  const result = await getResult(id);
  return successResponse(result);
});
