import fs from "fs";
import path from "path";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function getContentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const paramsData = await params;
  const primaryDir = path.resolve(process.cwd(), "..", "uploads");
  const legacyDir = path.resolve(process.cwd(), "public", "uploads");
  const segments = Array.isArray(paramsData.path) ? paramsData.path : [];
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return new Response("Bad Request", { status: 400 });
  }

  const candidates = [primaryDir, legacyDir]
    .map((base) => {
      const file = path.resolve(base, ...segments);
      const insideBase = file === base || file.startsWith(`${base}${path.sep}`);
      return insideBase ? file : "";
    })
    .filter(Boolean);

  const targetFile = candidates.find((file) => fs.existsSync(file));
  if (!targetFile) return new Response("Not Found", { status: 404 });

  const body = fs.readFileSync(targetFile);
  return new Response(body, {
    headers: {
      "Content-Type": getContentType(targetFile),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
