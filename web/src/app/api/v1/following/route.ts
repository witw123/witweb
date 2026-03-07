import { NextRequest } from "next/server";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleUserRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";

const querySchema = z.object({
  username: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional().default(""),
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  const { username, page, size, q } = await validateQuery(req, querySchema);
  const targetUsername = username || user;
  const result = await drizzleUserRepository.listFollowing(targetUsername, page, size, q);

  return successResponse(result);
});
