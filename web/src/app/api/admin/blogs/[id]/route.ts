import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  status: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.string().optional(),
  category_id: z.coerce.number().int().positive().optional(),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { id } = validateParams(await params, paramsSchema);
  const blog = postRepository.getAdminBlogDetail(id);
  if (!blog) return errorResponses.notFound("Blog not found");

  return successResponse(blog);
});

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { id } = validateParams(await params, paramsSchema);
  const body = await validateBody(req, updateSchema);
  postRepository.updateById(id, body);

  return successResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { id } = validateParams(await params, paramsSchema);
  postRepository.delete(id);

  return successResponse({ ok: true });
});
