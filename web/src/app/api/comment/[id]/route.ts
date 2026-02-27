import { getAuthUser, isAdminUser } from "@/lib/http";
import { commentRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  content: z.string().trim().min(1, "Empty content"),
});

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updateSchema);

  const comment = await commentRepository.findById(id);
  if (!comment) return errorResponses.notFound("Comment not found");
  if (!isAdminUser(user)) return errorResponses.forbidden("Forbidden");

  await commentRepository.updateContent(id, body.content);
  return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(await params, paramsSchema);

  const comment = await commentRepository.findById(id);
  if (!comment) return errorResponses.notFound("Comment not found");
  if (!isAdminUser(user)) return errorResponses.forbidden("Forbidden");

  await commentRepository.delete(id);
  return successResponse({ ok: true });
});
