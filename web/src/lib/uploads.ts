import fs from "fs";
import path from "path";

function uniqueDirs(dirs: string[]) {
  return Array.from(new Set(dirs));
}

export function getUploadsDir() {
  const configuredDir = process.env.UPLOAD_DIR?.trim();
  if (configuredDir) return path.resolve(configuredDir);

  const publicDir = path.resolve(process.cwd(), "public");
  if (fs.existsSync(publicDir)) {
    return path.join(publicDir, "uploads");
  }

  return path.resolve(process.cwd(), "..", "uploads");
}

export function getUploadSearchDirs() {
  return uniqueDirs([
    getUploadsDir(),
    path.resolve(process.cwd(), "..", "uploads"),
    path.resolve(process.cwd(), "public", "uploads"),
  ]);
}
