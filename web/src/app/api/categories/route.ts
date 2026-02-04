import { initDb } from "@/lib/db-init";
import { listCategories } from "@/lib/blog";

export async function GET() {
  initDb();
  const categories = listCategories(false);
  return Response.json({ items: categories });
}

