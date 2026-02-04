import { initDb } from "@/lib/db-init";
import { incrementPostView } from "@/lib/blog";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  initDb();
  const viewCount = incrementPostView(slug);
  return Response.json({ ok: true, view_count: viewCount });
}

