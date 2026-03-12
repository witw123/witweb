import { createdResponse, successResponse } from "@/lib/api-response";
import { listApiProviders, createApiProvider } from "@/lib/api-registry";
import { validateBody } from "@/lib/validate";
import { withErrorHandler } from "@/middleware/error-handler";
import { providerInputSchema, requireAdminApiPermission } from "@/app/api/admin/api-management-shared";

export const GET = withErrorHandler(async () => {
  await requireAdminApiPermission("api.read");
  const items = await listApiProviders();
  return successResponse({ items });
});

export const POST = withErrorHandler(async (req) => {
  const auth = await requireAdminApiPermission("api.manage");
  const body = await validateBody(req, providerInputSchema);
  const item = await createApiProvider(auth.username, body, req);
  return createdResponse(item);
});
