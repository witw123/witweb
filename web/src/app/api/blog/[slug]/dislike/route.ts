import { getAuthUser } from "@/lib/http";
import { ApiError, ErrorCode } from "@/lib/api-error";
import { postRepository } from "@/lib/repositories";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

export const POST = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  let disliked = false;
  try {
    const result = await postRepository.toggleLike(slug, user, -1);
    disliked = !!result.disliked;
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.POST_NOT_FOUND) {
      return errorResponses.notFound("Post not found");
    }
    throw error;
  }

  const post = await postRepository.getPostDetail(slug, user);
  return successResponse({
    ok: true,
    disliked,
    like_count: post?.like_count ?? 0,
    dislike_count: post?.dislike_count ?? 0,
    favorite_count: post?.favorite_count ?? 0,
    comment_count: post?.comment_count ?? 0,
  });
});
