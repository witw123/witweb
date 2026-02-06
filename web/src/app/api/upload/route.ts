/**
 */

import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import path from "path";
import fs from "fs/promises";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { errorResponses, createdResponse } from "@/lib/api-response";

export const POST = withErrorHandler(async (req: Request) => {
  initDb();
  
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");
  
  const form = await req.formData();
  const file = form.get("file") as File | null;
  
  if (!file) {
    return errorResponses.badRequest("缺少文件");
  }
  
  if (!file.type.startsWith("image/")) {
    return errorResponses.badRequest("仅支持上传图片文件");
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "");
  const ext = path.extname(safeName) || ".png";
  const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  
  // Keep upload path aligned with /uploads/[...path] route.ts
  const targetDir = path.resolve(process.cwd(), "..", "uploads");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, name), buffer);
  
  return createdResponse({ url: `/uploads/${name}` });
});

