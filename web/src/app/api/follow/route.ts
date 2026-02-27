import { getAuthUser } from "@/lib/http";
import { userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const followSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

export const POST = withErrorHandler(async (req: Request) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, followSchema);
  if (user !== body.username) {
    await userRepository.follow(user, body.username);
  }

  return successResponse({ ok: true });
});
