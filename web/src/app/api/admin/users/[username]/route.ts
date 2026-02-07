import { initDb } from "@/lib/db-init";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { getUserDetail, deleteUser } from "@/lib/admin";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateParams, z } from "@/lib/validate";

const paramsSchema = z.object({
  username: z.string().trim().min(1, "username is required"),
});

export const GET = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { username } = validateParams(await params, paramsSchema);
  const detail = getUserDetail(username);
  if (!detail) return errorResponses.notFound("User not found");

  return successResponse(detail);
});

export const DELETE = withErrorHandler(async (_: Request, { params }: { params: Promise<{ username: string }> }) => {
  initDb();

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "Admin access required");

  const { username } = validateParams(await params, paramsSchema);
  if (isAdminUser(username)) return errorResponses.forbidden("Cannot delete admin");

  deleteUser(username);
  return successResponse({ ok: true });
});
