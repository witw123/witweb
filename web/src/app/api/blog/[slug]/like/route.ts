import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { toggleLike, getPost } from "@/lib/blog";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  slug: z.string().trim().min(1, "slug is required"),
});

export const POST = withErrorHandler(async (_: Request, { params }: { params: Promise<{ slug: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { slug } = validateParams(await params, paramsSchema);
  const res = toggleLike(slug, user, 1);
  if (!res.ok) return errorResponses.notFound("Post not found");

  const post = getPost(slug, user);
  return successResponse({
    ok: true,
    liked: res.liked,
    like_count: post?.like_count ?? 0,
    dislike_count: post?.dislike_count ?? 0,
    favorite_count: post?.favorite_count ?? 0,
    comment_count: post?.comment_count ?? 0,
  });
});
