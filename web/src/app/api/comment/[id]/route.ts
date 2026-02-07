import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { updateComment, deleteComment } from "@/lib/blog";
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
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updateSchema);
  const res = updateComment(id, body.content, isAdminUser(user));

  if (!res.ok && res.error === "not_found") return errorResponses.notFound("Comment not found");
  if (!res.ok && res.error === "forbidden") return errorResponses.forbidden("Forbidden");
  if (!res.ok) return errorResponses.internal("Update failed");

  return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);

  const { id } = validateParams(await params, paramsSchema);
  const res = deleteComment(id, isAdminUser(user));

  if (!res.ok && res.error === "not_found") return errorResponses.notFound("Comment not found");
  if (!res.ok && res.error === "forbidden") return errorResponses.forbidden("Forbidden");
  if (!res.ok) return errorResponses.internal("Delete failed");

  return successResponse({ ok: true });
});
