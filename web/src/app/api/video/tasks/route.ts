/**
 */

import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listTasks } from "@/lib/video";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";

const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  task_type: z.string().optional(),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { page, limit, task_type } = await validateQuery(req, listTasksQuerySchema);

  const { tasks, total } = listTasks(user, page, limit, task_type);

  return paginatedResponse(tasks, total, page ?? 1, limit ?? 20);
});

