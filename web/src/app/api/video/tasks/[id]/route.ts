import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { getTask, pollAndUpdate } from "@/lib/video";
import { withErrorHandler, assertAuthenticated, assertExists } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
});

export const GET = withErrorHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user, "Please log in first");

  const { id } = validateParams(await params, paramsSchema);

  let task = getTask(id, user);
  assertExists(task, "Task not found");

  if (task.status === "pending" || task.status === "running") {
    try {
      await pollAndUpdate(id);
      task = getTask(id, user);
    } catch {}
  }

  return successResponse(task);
});
