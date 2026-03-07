import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleUserRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";

const followSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, followSchema);
  if (user !== body.username) {
    await drizzleUserRepository.follow(user, body.username);
  }

  return successResponse({ ok: true });
});
