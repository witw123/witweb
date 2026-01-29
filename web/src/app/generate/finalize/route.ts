import { finalizeVideo } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(await finalizeVideo(body.id, body.prompt));
}
