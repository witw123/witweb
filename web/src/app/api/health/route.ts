/**
 */

import { checkPostgresHealth, isPostgresConfigured } from "@/lib/db-postgres";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const postgres = await checkPostgresHealth();
  const status = isPostgresConfigured() && !postgres.healthy ? "degraded" : "healthy";

  return successResponse({
    status,
    timestamp: new Date().toISOString(),
    postgres,
  });
});
