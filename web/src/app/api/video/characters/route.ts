/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { listCharacters } from "@/lib/video";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const characters = listCharacters(user);

  return successResponse({ characters });
});

