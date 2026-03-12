/**
 * 完成视频生成
 *
 * 完成视频的最终处理，可选地添加提示词
 *
 * @route /api/v1/video/outputs/finalize
 * @method POST - 完成视频生成
 * @param {string} id - 任务 ID
 * @param {string} [prompt] - 可选的提示词
 * @returns {Promise<Object>} 完成结果
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { finalizeVideo } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const finalizeSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
  prompt: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "Please log in first");

  const { id, prompt } = await validateBody(req, finalizeSchema);
  const result = await finalizeVideo(id, prompt ?? "");

  return successResponse(result);
});
