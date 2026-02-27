import { postRepository } from "@/lib/repositories";
import { successResponse, errorResponses } from "@/lib/api-response";
import { withErrorHandler } from "@/middleware/error-handler";
import { validateParams, validateQuery, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(10),
});

export const GET = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) => {
  const { username } = validateParams(await params, paramsSchema);
  if (!username) return errorResponses.badRequest("Invalid username");

  const { page, size } = await validateQuery(request, querySchema);
  const data = await postRepository.getActivities(username, page, size);
  return successResponse({ items: data.items, total: data.total });
});
