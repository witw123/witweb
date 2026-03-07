import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/drizzle";
import { categories, posts } from "@/lib/db/schema";
import type { Category } from "@/types";

export class DrizzleCategoryRepository {
  async listCategories(includeInactive = false): Promise<Category[]> {
    const db = getDb();

    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        sort_order: categories.sortOrder,
        is_active: categories.isActive,
        created_at: categories.createdAt,
        updated_at: categories.updatedAt,
        post_count: sql<number>`coalesce(count(${posts.id}), 0)::int`,
      })
      .from(categories)
      .leftJoin(
        posts,
        and(eq(posts.categoryId, categories.id), ne(posts.status, "deleted"))
      )
      .where(includeInactive ? undefined : eq(categories.isActive, 1))
      .groupBy(
        categories.id,
        categories.name,
        categories.slug,
        categories.description,
        categories.sortOrder,
        categories.isActive,
        categories.createdAt,
        categories.updatedAt
      )
      .orderBy(asc(categories.sortOrder), asc(categories.id));

    return rows.map((row) => ({
      ...row,
      post_count: Number(row.post_count || 0),
    }));
  }
}

export const drizzleCategoryRepository = new DrizzleCategoryRepository();
