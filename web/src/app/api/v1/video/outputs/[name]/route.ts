import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { deleteVideo } from "@/lib/studio";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

export const DELETE = withErrorHandler(async (_req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { name } = await context.params;
  await deleteVideo(name);

  return successResponse({ ok: true });
});
