import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { drizzleUserRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
});

export const DELETE = withErrorHandler(
  async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
    const user = await getAuthUser();
    assertAuthenticated(user);

    const parsed = validateParams(await params, paramsSchema);
    await drizzleUserRepository.unfollow(user, parsed.username);

    return successResponse({ ok: true });
  }
);
