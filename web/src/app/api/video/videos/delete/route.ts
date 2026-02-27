/**
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { deleteVideo } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const deleteVideoSchema = z.object({
  name: z.string().min(1, "Video name is required"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { name } = await validateBody(req, deleteVideoSchema);

  await deleteVideo(name);

  return successResponse({ ok: true });
});


