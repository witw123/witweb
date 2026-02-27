/**
 */

import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { videoTaskRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";
import type { VideoTaskType } from "@/types";

const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  task_type: z.enum(["text2video", "image2video", "remix", "character", "upload_character", "create_character"]).optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, limit, task_type } = await validateQuery(req, listTasksQuerySchema);

  const result = videoTaskRepository.listByUser(user, page, limit, task_type as VideoTaskType | undefined);

  return paginatedResponse(result.items, result.total, page ?? 1, limit ?? 20);
});
