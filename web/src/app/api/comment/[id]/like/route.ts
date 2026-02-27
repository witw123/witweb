import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { commentRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("评论ID必须是正整数"),
});

export const POST = withErrorHandler(async (_req, { params }) => {
  const paramsData = await params;
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(paramsData, paramsSchema);

  commentRepository.vote(id, user, 1);

  return successResponse({ message: "点赞成功" });
});
