/**
 */

import { getAuthUser, isAdminUser } from "@/lib/http";
import { setToken } from "@/lib/studio";
import {
  withErrorHandler,
  assertAuthenticated,
  assertAuthorized,
} from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const tokenSchema = z.object({
  token: z.string().default(""),
});

export const POST = withErrorHandler(async (req) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const body = await validateBody(req, tokenSchema);

  await setToken(body.token ?? "");

  return successResponse({ ok: true });
});

