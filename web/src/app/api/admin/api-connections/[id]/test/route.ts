import { successResponse } from "@/lib/api-response";
import { testApiConnection } from "@/lib/api-registry";
import { validateParams, z } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";
import { requireAdminApiPermission } from "@/app/api/admin/api-management-shared";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export const POST = withErrorHandler(async (req, context) => {
  const auth = await requireAdminApiPermission("api.manage");
  const params = validateParams(await context.params, paramsSchema);
  const result = await testApiConnection(params.id, auth.username, req);
  return successResponse(result);
});
