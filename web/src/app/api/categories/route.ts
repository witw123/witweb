import { postRepository } from "@/lib/repositories";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withErrorHandler(async () => {

  const categories = await postRepository.listCategories(false);

  return successResponse({ items: categories });
});
