import { initDb } from "@/lib/db-init";
import { listCategories } from "@/lib/blog";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withErrorHandler(async () => {
  initDb();

  const categories = listCategories(false);

  return successResponse({ items: categories });
});
