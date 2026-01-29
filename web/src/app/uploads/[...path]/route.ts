import fs from "fs";
import path from "path";

export async function GET(_: Request, { params }: { params: { path: string[] } }) {
  const paramsData = await Promise.resolve(params);
  const rel = paramsData.path.join("/");
  const file = path.resolve(process.cwd(), "..", "uploads", rel);
  if (!fs.existsSync(file)) return new Response("Not Found", { status: 404 });
  const body = fs.readFileSync(file);
  return new Response(body);
}
