import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/http";
import { getResult } from "@/lib/studio";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const resultSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {

  const user = await getAuthUser();
  assertAuthenticated(user, "Please log in first");

  const { id } = await validateBody(req, resultSchema);
  const result = await getResult(id);

  return successResponse(result);
});
