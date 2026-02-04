import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { createCategory, listCategories } from "@/lib/admin";

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 100);
  const search = url.searchParams.get("search") || "";

  return Response.json(listCategories(page, limit, search));
}

export async function POST(req: Request) {
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const rawSlug = String(body?.slug || "").trim();
  const slug = slugify(rawSlug || name);
  if (!name || !slug) {
    return Response.json({ detail: "分类名称不能为空" }, { status: 400 });
  }
  try {
    const id = createCategory({
      name,
      slug,
      description: body?.description || "",
      is_active: body?.is_active === 0 ? 0 : 1,
    });
    return Response.json({ ok: true, id });
  } catch (error: any) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return Response.json({ detail: "分类名称或别名已存在" }, { status: 409 });
    }
    return Response.json({ detail: "创建失败" }, { status: 500 });
  }
}

