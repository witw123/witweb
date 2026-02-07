import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { followUser } from "@/lib/follow";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const followSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, followSchema);
  followUser(user, body.username);

  return successResponse({ ok: true });
});
