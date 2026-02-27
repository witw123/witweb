/**
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { createCharacterTask } from "@/lib/studio";
import { videoTaskRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const createCharacterSchema = z.object({
  pid: z.string().min(1, "PID不能为空"),
  timestamps: z.string().default("0,3"),
  webHook: z.string().default("-1"),
  shutProgress: z.boolean().default(false),
});

export const POST = withErrorHandler(async (req: NextRequest) => {

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const body = await validateBody(req, createCharacterSchema);

  const taskId = await createCharacterTask({
    pid: body.pid.trim(),
    timestamps: body.timestamps,
    webHook: body.webHook,
    shutProgress: body.shutProgress,
  });

  await videoTaskRepository.create({
    id: taskId,
    username: user,
    task_type: "create_character",
    pid: body.pid,
    timestamps: body.timestamps,
  });
  await videoTaskRepository.updateStatus(taskId, { status: "running", progress: 0 });

  return successResponse({ ok: true, task_id: taskId, id: taskId });
});
