import { createCharacter } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(await createCharacter({
    pid: body.pid,
    timestamps: body.timestamps,
    webHook: body.webHook || "-1",
    shutProgress: body.shutProgress,
  }));
}
