/**
 * Upload API - 文件上传数据处理
 *
 * 提供图片上传功能
 * 验证用户登录状态，仅允许上传图片文件
 */

import fs from "fs/promises";
import path from "path";
import { createdResponse, errorResponses } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { assertAuthenticated } from "@/middleware/error-handler";

/**
 * 处理图片上传 POST 请求
 *
 * 验证用户登录状态，接受图片文件并保存到服务器
 * 文件名经过安全处理，防止路径遍历攻击
 *
 * @param {Request} req - HTTP 请求对象，包含 formData 中的文件
 * @returns {Promise<Response>} 上传结果响应，包含文件访问 URL
 */
export async function handleUploadPost(req: Request) {
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

  const targetDir = path.resolve(process.cwd(), "..", "uploads");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, name), buffer);

  return createdResponse({ url: `/uploads/${name}` });
}
