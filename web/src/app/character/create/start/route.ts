import { createCharacterTask } from "@/lib/studio";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = await createCharacterTask({
    pid: body.pid,
    timestamps: body.timestamps,
    webHook: body.webHook || "-1",
    shutProgress: body.shutProgress,
  });
  return Response.json({ id });
}
