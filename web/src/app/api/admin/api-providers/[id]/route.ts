import { successResponse } from "@/lib/api-response";
import { updateApiProvider } from "@/lib/api-registry";
import { validateBody, validateParams, z } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";
import { providerPatchSchema, requireAdminApiPermission } from "@/app/api/admin/api-management-shared";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const PUT = withErrorHandler(async (req, context) => {
  const auth = await requireAdminApiPermission("api.manage");
  const params = validateParams(await context.params, paramsSchema);
  const body = await validateBody(req, providerPatchSchema);
  const item = await updateApiProvider(params.id, auth.username, body, req);
  return successResponse(item);
});
