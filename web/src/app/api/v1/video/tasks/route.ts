/**
 * 视频任务列表 API
 *
 * 获取当前用户的视频任务列表
 *
 * @route /api/v1/video/tasks
 * @method GET - 获取视频任务列表
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { videoTaskRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";
import type { VideoTaskType } from "@/types";

/** 查询参数验证 Schema */
const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  task_type: z.enum(["text2video", "image2video", "remix", "character", "upload_character", "create_character"]).optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, limit, task_type } = await validateQuery(req, listTasksQuerySchema);
  const result = await videoTaskRepository.listByUser(user, page, limit, task_type as VideoTaskType | undefined);

  return paginatedResponse(result.items, result.total, page ?? 1, limit ?? 20);
});
