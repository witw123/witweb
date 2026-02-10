import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { deleteRadarSavedTopic } from "@/lib/topic-radar";

export const DELETE = withErrorHandler(async (_req, context) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const topicId = Number(id);

  try {
    const result = deleteRadarSavedTopic(topicId, user);
    return successResponse(result);
  } catch {
    return errorResponses.notFound("选题不存在");
  }
});

