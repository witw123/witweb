/**
 */

import { getAuthUser } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { isAdminUser } from "@/lib/http";

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "ID 列表不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const body = await validateBody(req, reorderSchema);

  await postRepository.reorderCategories(body.ids);

  return successResponse({ reordered: true });
});
