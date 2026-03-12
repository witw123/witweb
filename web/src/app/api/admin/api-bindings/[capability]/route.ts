import { successResponse } from "@/lib/api-response";
import { updateApiBinding } from "@/lib/api-registry";
import { validateBody, validateParams } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";
import {
  bindingInputSchema,
  capabilityParamSchema,
  requireAdminApiPermission,
} from "@/app/api/admin/api-management-shared";

export const PUT = withErrorHandler(async (req, context) => {
  const auth = await requireAdminApiPermission("api.manage");
  const params = validateParams(await context.params, capabilityParamSchema);
  const body = await validateBody(req, bindingInputSchema);
  const item = await updateApiBinding(params.capability, auth.username, body, req);
  return successResponse(item);
});
