/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { getHistory } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const history = getHistory();

  return successResponse(history);
});

