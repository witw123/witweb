/**
 * 获取视频任务状态
 *
 * 获取指定视频生成任务的状态和结果，如果任务仍在进行中则轮询更新状态
 *
 * @route /api/v1/video/tasks/:id
 * @method GET - 获取任务状态
 * @param {string} id - 任务 ID
 * @returns {Promise<VideoTaskWithResults>} 任务信息，包含状态和结果
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { videoTaskRepository } from "@/lib/repositories";
import { getResult } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated, assertExists } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";
import type { VideoTaskStatus, VideoTaskWithResults } from "@/types";

const paramsSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
});

/**
 * 轮询并更新任务状态
 *
 * 从外部服务获取任务最新状态，更新本地数据库记录
 * 如果任务成功完成，同时保存生成结果
 *
 * @param {string} taskId - 任务 ID
 * @returns {Promise<void>}
 */
async function pollAndUpdate(taskId: string): Promise<void> {
  const result = await getResult(taskId);
  const rawStatus = result?.status;
  const status: VideoTaskStatus =
    rawStatus === "pending" ||
    rawStatus === "running" ||
    rawStatus === "succeeded" ||
    rawStatus === "failed" ||
    rawStatus === "completed"
      ? rawStatus
      : "running";
  const progress = result?.progress || 0;

  await videoTaskRepository.updateStatus(taskId, {
    status,
    progress,
    result_json: JSON.stringify(result),
    failure_reason: result?.failure_reason,
    error: result?.error,
  });

  if (status === "succeeded" && result?.results) {
    await videoTaskRepository.addResults(
      taskId,
      result.results.map((r: { url: string; removeWatermark?: boolean; pid?: string; character_id?: string }) => ({
        url: r.url,
        remove_watermark: !!r.removeWatermark,
        pid: r.pid,
        character_id: r.character_id || undefined,
      }))
    );
  }
}

export const GET = withErrorHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getAuthUser();
  assertAuthenticated(user, "Please log in first");

  const { id } = validateParams(await params, paramsSchema);

  let task: VideoTaskWithResults | null = null;
  const current = await videoTaskRepository.findByIdAndUser(id, user);
  if (current) {
    task = { ...current, results: await videoTaskRepository.getResultsByTaskId(id) };
  }
  assertExists(task, "Task not found");

  if (task.status === "pending" || task.status === "running") {
    try {
      await pollAndUpdate(id);
      const refreshed = await videoTaskRepository.findByIdAndUser(id, user);
      if (refreshed) {
        task = { ...refreshed, results: await videoTaskRepository.getResultsByTaskId(id) };
      }
    } catch {}
  }

  return successResponse(task);
});
