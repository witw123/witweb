import { searchKnowledge } from "@/lib/knowledge";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  query: z.string().trim().min(2),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await searchKnowledge(user, body);
  return successResponse(result);
});
