import { initDb } from "@/lib/db-init";
import { requireAdminUser } from "@/lib/http";
import { deleteCategory, updateCategory } from "@/lib/admin";

function slugify(text: string) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;

  const body = await req.json().catch(() => ({}));
  const payload: any = {};
  if (body?.name !== undefined) payload.name = String(body.name || "").trim();
  if (body?.slug !== undefined) payload.slug = slugify(String(body.slug || ""));
  if (body?.description !== undefined) payload.description = String(body.description || "");
  if (body?.is_active !== undefined) payload.is_active = body.is_active === 0 ? 0 : 1;
  try {
    updateCategory(Number(id), payload);
    return Response.json({ ok: true });
  } catch (error: any) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return Response.json({ detail: "分类名称或别名已存在" }, { status: 409 });
    }
    return Response.json({ detail: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  initDb();
  const user = await requireAdminUser();
  if (user instanceof Response) return user;
  deleteCategory(Number(id));
  return Response.json({ ok: true });
}

