import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { toggleLike, getPost } from "@/lib/blog";
import { successResponse, errorResponses } from "@/lib/api-response";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const paramsData = await params;
  initDb();
  const user = await getAuthUser();
  if (!user) return errorResponses.unauthorized("Missing token");
  const res = toggleLike(paramsData.slug, user, 1);
  if (!res.ok) return errorResponses.notFound("Post not found");
  const post = getPost(paramsData.slug, user) || {} as any;
  return successResponse({
    ok: true,
    liked: res.liked,
    like_count: post.like_count ?? 0,
    dislike_count: post.dislike_count ?? 0,
    favorite_count: post.favorite_count ?? 0,
    comment_count: post.comment_count ?? 0,
  });
}
