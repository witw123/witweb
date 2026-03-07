import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleCommentRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("评论 ID 必须是正整数"),
});

export const POST = withErrorHandler(async (_req, { params }) => {
  const paramsData = await params;

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(paramsData, paramsSchema);

  await drizzleCommentRepository.vote(id, user, -1);

  return successResponse({ message: "点踩成功" });
});
