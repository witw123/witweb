import { successResponse } from "@/lib/api-response";
import { deleteApiConnection, getApiConnection, updateApiConnection } from "@/lib/api-registry";
import { validateBody, validateParams, z } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";
import { connectionPatchSchema, requireAdminApiPermission } from "@/app/api/admin/api-management-shared";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const GET = withErrorHandler(async (_req, context) => {
  await requireAdminApiPermission("api.read");
  const params = validateParams(await context.params, paramsSchema);
  const item = await getApiConnection(params.id);
  return successResponse(item);
});

export const PUT = withErrorHandler(async (req, context) => {
  const auth = await requireAdminApiPermission("api.manage");
  const params = validateParams(await context.params, paramsSchema);
  const body = await validateBody(req, connectionPatchSchema);
  const item = await updateApiConnection(params.id, auth.username, body, req);
  return successResponse(item);
});

export const DELETE = withErrorHandler(async (req, context) => {
  const auth = await requireAdminApiPermission("api.manage");
  const params = validateParams(await context.params, paramsSchema);
  const result = await deleteApiConnection(params.id, auth.username, req);
  return successResponse(result);
});
