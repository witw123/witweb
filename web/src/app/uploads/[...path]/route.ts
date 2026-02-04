import fs from "fs";
import path from "path";

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const paramsData = await params;
  const baseDir = path.resolve(process.cwd(), "..", "uploads");
  const segments = Array.isArray(paramsData.path) ? paramsData.path : [];
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return new Response("Bad Request", { status: 400 });
  }
  const file = path.resolve(baseDir, ...segments);
  const insideBase = file === baseDir || file.startsWith(`${baseDir}${path.sep}`);
  if (!insideBase) return new Response("Bad Request", { status: 400 });
  if (!fs.existsSync(file)) return new Response("Not Found", { status: 404 });
  const body = fs.readFileSync(file);
  return new Response(body);
}
