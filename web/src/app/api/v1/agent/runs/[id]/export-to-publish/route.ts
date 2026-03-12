/**
 * Agent 发布导出 API
 *
 * 将 Agent 生成的草稿内容（标题、正文、标签）导出为博客发布格式
 *
 * @route /api/v1/agent/runs/:id/export-to-publish
 * @method POST - 导出为发布格式
 * @requiresAuth 需要用户认证
 */
import { exportToPublish } from "@/lib/agent";
import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser } from "@/lib/http";
import { validateBody, z } from "@/lib/validate";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";

const bodySchema = z.object({
  title_artifact_id: z.number().int().positive().optional(),
  content_artifact_id: z.number().int().positive().optional(),
  tags_artifact_id: z.number().int().positive().optional(),
});

export const POST = withErrorHandler(async (req, context) => {
  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = await context.params;
  const body = await validateBody(req, bodySchema);

  try {
    const payload = await exportToPublish(id, user, {
      titleArtifactId: body.title_artifact_id,
      contentArtifactId: body.content_artifact_id,
      tagsArtifactId: body.tags_artifact_id,
    });
    return successResponse(payload);
  } catch {
    return errorResponses.notFound("task_not_found");
  }
});
