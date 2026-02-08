import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse, errorResponses } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { exportToPublish } from "@/lib/agent";

const bodySchema = z.object({
  title_artifact_id: z.number().int().positive().optional(),
  content_artifact_id: z.number().int().positive().optional(),
  tags_artifact_id: z.number().int().positive().optional(),
});

export const POST = withErrorHandler(async (req, context) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const body = await validateBody(req, bodySchema);

  try {
    const payload = exportToPublish(id, user, {
      titleArtifactId: body.title_artifact_id,
      contentArtifactId: body.content_artifact_id,
      tagsArtifactId: body.tags_artifact_id,
    });
    return successResponse(payload);
  } catch {
    return errorResponses.notFound("任务不存在");
  }
});

