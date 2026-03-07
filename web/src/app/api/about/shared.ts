import { successResponse } from "@/lib/api-response";
import { getAuthIdentity } from "@/lib/http";
import { aboutRepository, drizzlePostRepository } from "@/lib/repositories";
import { validateBody, z } from "@/lib/validate";
import { assertAuthorized } from "@/middleware/error-handler";

const linkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(500),
});

const updateAboutSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80, "Title is too long"),
  subtitle: z.string().trim().max(160, "Subtitle is too long").default(""),
  content: z.string().trim().min(1, "Content is required").max(12000, "Content is too long"),
  links: z.array(linkSchema).max(20, "Too many links").default([]),
  skills: z.array(z.string().trim().min(1).max(40)).max(30, "Too many skills").default([]),
});

export async function buildAboutGetResponse(): Promise<Response> {
  const about = await aboutRepository.get();

  let recentPosts: { title: string; slug: string; created_at: string }[] = [];
  try {
    const result = await drizzlePostRepository.list({ page: 1, size: 5 });
    recentPosts = result.items.map((p) => ({
      title: p.title,
      slug: p.slug,
      created_at: p.created_at,
    }));
  } catch {}

  return successResponse({ ...about, recentPosts });
}

export async function buildAboutPutResponse(req: Request): Promise<Response> {
  const auth = await getAuthIdentity();
  assertAuthorized(!!auth && auth.role === "super_admin", "Forbidden");
  const updater = auth?.username || "";

  const body = await validateBody(req, updateAboutSchema, { message: "Invalid about payload" });
  const saved = await aboutRepository.upsert({
    title: body.title,
    subtitle: body.subtitle || "",
    content: body.content,
    links: body.links || [],
    skills: body.skills || [],
    updated_by: updater,
  });

  return successResponse(saved);
}
