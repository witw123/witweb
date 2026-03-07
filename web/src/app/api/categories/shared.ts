import { successResponse } from "@/lib/api-response";
import { drizzleCategoryRepository } from "@/lib/repositories/category-repository.drizzle";

export async function buildCategoriesResponse(): Promise<Response> {
  const categories = await drizzleCategoryRepository.listCategories(false);
  return successResponse({ items: categories });
}
