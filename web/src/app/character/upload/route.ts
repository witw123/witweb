import { uploadCharacter } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(await uploadCharacter({
    url: body.url,
    timestamps: body.timestamps,
    webHook: body.webHook || "-1",
    shutProgress: body.shutProgress,
  }));
}
