import { successResponse } from "@/lib/api-response";
import { listApiBindings } from "@/lib/api-registry";
import { withErrorHandler } from "@/middleware/error-handler";
import { requireAdminApiPermission } from "@/app/api/admin/api-management-shared";

export const GET = withErrorHandler(async () => {
  await requireAdminApiPermission("api.read");
  const items = await listApiBindings();
  return successResponse({ items });
});
