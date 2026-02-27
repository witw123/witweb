import { getAuthUser } from "@/lib/http";
import { userRepository } from "@/lib/repositories";
import { publicProfile } from "@/lib/user";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(50).optional(),
  avatar_url: z.string().trim().optional(),
  cover_url: z.string().trim().optional(),
  bio: z.string().trim().max(500).optional(),
});

export const GET = withErrorHandler(async () => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const profile = await publicProfile(user, user);
  return successResponse({ profile });
});

export const POST = withErrorHandler(async (req: Request) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, profileSchema);

  await userRepository.update(user, {
    nickname: body.nickname || user,
    avatar_url: body.avatar_url || "",
    cover_url: body.cover_url || "",
    bio: body.bio || "",
  });

  const profile = await publicProfile(user, user);
  return successResponse({ profile });
});
