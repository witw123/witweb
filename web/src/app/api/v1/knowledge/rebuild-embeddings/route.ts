import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { rebuildKnowledgeEmbeddings } from "@/lib/knowledge-rebuild";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  source_types: z.array(z.string().trim().min(1)).optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await rebuildKnowledgeEmbeddings(user, {
    limit: body.limit,
    offset: body.offset,
    sourceTypes: body.source_types,
  });

  return successResponse(result);
});
