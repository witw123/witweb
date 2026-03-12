import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { backfillCreatorKnowledge } from "@/lib/knowledge-backfill";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  include_posts: z.boolean().optional(),
  include_about: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await backfillCreatorKnowledge(user, {
    includePosts: body.include_posts,
    includeAbout: body.include_about,
    limit: body.limit,
  });

  return successResponse(result);
});
