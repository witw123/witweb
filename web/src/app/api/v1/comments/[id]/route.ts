/**
 * 评论操作 API
 *
 * 提供评论更新、删除功能
 *
 * @route /api/v1/comments/{id}
 * @method PUT - 更新评论
 * @method DELETE - 删除评论
 */

import { errorResponses, successResponse } from "@/lib/api-response";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { drizzleCommentRepository } from "@/lib/repositories";
import { assertAuthenticated, withErrorHandler } from "@/middleware/error-handler";
import { validateBody, validateParams, z } from "@/lib/validate";

/** 路径参数验证 Schema */
const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  content: z.string().trim().min(1, "Empty content"),
});

export const PUT = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getAuthUser();
    assertAuthenticated(user);

    const { id } = validateParams(await params, paramsSchema);
    const body = await validateBody(req, updateSchema);

    const comment = await drizzleCommentRepository.findById(id);
    if (!comment) return errorResponses.notFound("Comment not found");
    if (!isAdminUser(user)) return errorResponses.forbidden("Forbidden");

    await drizzleCommentRepository.updateContent(id, body.content);
    return successResponse({ ok: true });
  }
);

export const DELETE = withErrorHandler(
  async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await getAuthUser();
    assertAuthenticated(user);

    const { id } = validateParams(await params, paramsSchema);

    const comment = await drizzleCommentRepository.findById(id);
    if (!comment) return errorResponses.notFound("Comment not found");
    if (!isAdminUser(user)) return errorResponses.forbidden("Forbidden");

    await drizzleCommentRepository.delete(id);
    return successResponse({ ok: true });
  }
);
