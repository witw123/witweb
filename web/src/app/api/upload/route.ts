import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import path from "path";
import fs from "fs/promises";

export async function POST(req: Request) {
  initDb();
  const user = await getAuthUser();
  if (!user) return Response.json({ detail: "Missing token" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ detail: "Missing file" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return Response.json({ detail: "Only image files allowed" }, { status: 400 });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "");
  const ext = path.extname(safeName) || ".png";
  const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const targetDir = path.resolve(process.cwd(), "..", "uploads");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, name), buffer);
  return Response.json({ ok: true, url: `/uploads/${name}` });
}
