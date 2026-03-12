import { indexKnowledgeDocument } from "@/lib/knowledge";
import { successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  source_type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  body: z.string().trim().min(10),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = withErrorHandler(async (req) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const result = await indexKnowledgeDocument(user, {
    sourceType: body.source_type,
    title: body.title,
    body: body.body,
    metadata: body.metadata,
  });

  return successResponse(result);
});
