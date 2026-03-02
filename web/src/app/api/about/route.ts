import { aboutRepository } from "@/lib/repositories";
import { postRepository } from "@/lib/repositories";
import { getAuthIdentity } from "@/lib/http";
import { successResponse } from "@/lib/api-response";
import { withErrorHandler, assertAuthorized } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";

const linkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(500),
});

const updateAboutSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(80, "标题最多 80 字"),
  subtitle: z.string().trim().max(160, "副标题最多 160 字").default(""),
  content: z.string().trim().min(1, "内容不能为空").max(12000, "内容最多 12000 字"),
  links: z.array(linkSchema).max(20, "最多 20 个链接").default([]),
  skills: z.array(z.string().trim().min(1).max(40)).max(30, "最多 30 个技能标签").default([]),
});

export const GET = withErrorHandler(async () => {
  const about = await aboutRepository.get();

  // Fetch recent 5 published posts
  let recentPosts: { title: string; slug: string; created_at: string }[] = [];
  try {
    const result = await postRepository.list({ page: 1, size: 5 });
    recentPosts = result.items.map((p) => ({
      title: p.title,
      slug: p.slug,
      created_at: p.created_at,
    }));
  } catch {
    // ignore errors — recent posts are optional
  }

  return successResponse({ ...about, recentPosts });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const auth = await getAuthIdentity();
  assertAuthorized(!!auth && auth.role === "super_admin", "仅超级管理员可以编辑关于我");
  const updater = auth?.username || "";

  const body = await validateBody(req, updateAboutSchema, { message: "关于我内容校验失败" });
  const saved = await aboutRepository.upsert({
    title: body.title,
    subtitle: body.subtitle || "",
    content: body.content,
    links: body.links || [],
    skills: body.skills || [],
    updated_by: updater,
  });
  return successResponse(saved);
});
