import { getAuthUser } from "@/lib/http";
import { userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const parsed = validateParams(await params, paramsSchema);
  await userRepository.unfollow(user, parsed.username);

  return successResponse({ ok: true });
});
