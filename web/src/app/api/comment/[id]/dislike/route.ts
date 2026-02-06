import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { voteComment } from "@/lib/blog";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("评论ID必须是正整数"),
});

export const POST = withErrorHandler(async (req, { params }) => {
  const paramsData = await params;
  initDb();

  // 楠岃瘉鐢ㄦ埛宸茬櫥褰?
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(paramsData, paramsSchema);

  // 鐐硅俯璇勮
  voteComment(id, user, -1);

  return successResponse({ message: "点踩成功" });
});
