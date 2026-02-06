/**
 */

import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { getAuthUser } from "@/lib/http";
import { deleteVideo } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const deleteVideoSchema = z.object({
  name: z.string().min(1, "Video name is required"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user, "请先登录");

  const { name } = await validateBody(req, deleteVideoSchema);

  deleteVideo(name);

  return successResponse({ ok: true });
});


