import { generateVideo } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(await generateVideo({
    model: "sora-2",
    prompt: body.prompt,
    duration: body.duration,
    url: body.url,
    aspectRatio: body.aspectRatio,
    size: body.size,
    remixTargetId: body.remixTargetId,
    webHook: "-1",
    shutProgress: body.shutProgress,
  }));
}
