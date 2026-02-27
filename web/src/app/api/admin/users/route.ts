/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { paginatedResponse } from "@/lib/api-response";
import { validateQuery, z } from "@/lib/validate";
import { isAdminUser } from "@/lib/http";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().default(""),
  sort: z.string().default("created_at_desc"),
});

export const GET = withErrorHandler(async (req: Request) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const { page, limit, search, sort } = await validateQuery(req, querySchema);

  const result = userRepository.listAdmin(page, limit, search, sort);

  return paginatedResponse(result.items, result.total, page ?? 1, limit ?? 20);
});
