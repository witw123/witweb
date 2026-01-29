import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { toggleLike, getPost } from "@/lib/blog";

export async function POST(_: Request, { params }: { params: { slug: string } }) {
  const paramsData = await Promise.resolve(params);
    initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const res = toggleLike(paramsData.slug, user, -1);
  if (!res.ok) return Response.json({ detail: "Post not found" }, { status: 404 });
  const post = getPost(paramsData.slug, user) || {} as any;
  return Response.json({
    ok: true,
    disliked: res.disliked,
    like_count: post.like_count ?? 0,
    dislike_count: post.dislike_count ?? 0,
    favorite_count: post.favorite_count ?? 0,
    comment_count: post.comment_count ?? 0,
  });
}
