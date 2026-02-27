import { initDb } from "@/lib/db-init";
import { postRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withErrorHandler(async () => {
  initDb();

  const categories = postRepository.listCategories(false);

  return successResponse({ items: categories });
});
