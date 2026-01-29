import { deleteVideo } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  deleteVideo(body.name);
  return Response.json({ ok: true });
}
