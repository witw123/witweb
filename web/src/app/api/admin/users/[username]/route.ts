import { getAuthUser, isAdminUser } from "@/lib/http";
import { commentRepository, postRepository, userRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { username } = validateParams(await params, paramsSchema);
  const profile = await userRepository.findByUsername(username);
  if (!profile) return errorResponses.notFound("User not found");

  const detail = {
    username: profile.username,
    created_at: profile.created_at,
    status: "active",
    last_login: null,
    blog_count: await postRepository.getPostCountByAuthor(username),
  };

  return successResponse(detail);
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { username } = validateParams(await params, paramsSchema);
  if (isAdminUser(username)) return errorResponses.forbidden("Cannot delete admin");

  await postRepository.deleteByAuthor(username);
  await commentRepository.deleteByAuthor(username);
  await postRepository.deleteLikesByUsername(username);
  await postRepository.deleteDislikesByUsername(username);
  await postRepository.deleteFavoritesByUsername(username);
  await commentRepository.deleteVotesByUsername(username);
  await userRepository.deleteFollowRelations(username);
  await userRepository.deleteByUsername(username);

  return successResponse({ ok: true });
});
