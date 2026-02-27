/**
 */

import { getAuthUser } from "@/lib/http";
import { videoTaskRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const characters = await videoTaskRepository.listCharacters(user);

  return successResponse({ characters });
});
