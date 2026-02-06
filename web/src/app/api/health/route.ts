/**
 */

import { initDb } from "@/lib/db-init";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  initDb();
  return successResponse({ status: "healthy", timestamp: new Date().toISOString() });
});
