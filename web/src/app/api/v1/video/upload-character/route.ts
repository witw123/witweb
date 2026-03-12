/**
 * 上传数字人角色任务
 *
 * 通过 URL 上传图片来创建数字人角色，生成任务并提交到外部服务
 *
 * @route /api/v1/video/upload-character
 * @method POST - 上传数字人角色
 * @param {string} url - 图片 URL
 * @param {string} [timestamps="0,3"] - 时间戳范围
 * @param {string} [webHook="-1"] - Webhook URL
 * @param {boolean} [shutProgress=false] - 是否关闭进度通知
 * @returns {Promise<Object>} 创建的任务信息 { ok: boolean, task_id: string, id: string }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { uploadCharacterTask } from "@/lib/studio";
import { videoTaskRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const uploadCharacterSchema = z.object({
  url: z.string().min(1, "URL不能为空"),
  timestamps: z.string().default("0,3"),
  webHook: z.string().default("-1"),
  shutProgress: z.boolean().default(false),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const body = await validateBody(req, uploadCharacterSchema);
  const taskId = await uploadCharacterTask({
    url: body.url.trim(),
    timestamps: body.timestamps,
    webHook: body.webHook,
    shutProgress: body.shutProgress,
  });

  await videoTaskRepository.create({
    id: taskId,
    username: user,
    task_type: "upload_character",
    url: body.url,
    timestamps: body.timestamps,
  });
  await videoTaskRepository.updateStatus(taskId, { status: "running", progress: 0 });

  return successResponse({ ok: true, task_id: taskId, id: taskId });
});
