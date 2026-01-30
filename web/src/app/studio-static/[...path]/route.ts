import fs from "fs";
import path from "path";

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const paramsData = await params;
    const rel = paramsData.path.join("/");
  const file = path.resolve(process.cwd(), "..", "studio", rel);
  if (!fs.existsSync(file)) return new Response("Not Found", { status: 404 });
  const body = fs.readFileSync(file);
  return new Response(body);
}
