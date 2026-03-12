/**
 * About 页面 API - 关于页面数据处理
 *
 * 提供关于页面的 GET（获取）和 PUT（更新）功能
 * GET 返回站点介绍信息和最近文章
 * PUT 仅允许超级管理员更新内容
 */

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

/**
 * 构建关于页面 GET 响应
 *
 * 获取站点介绍信息和最近发布的 5 篇文章
 *
 * @returns {Promise<Response>} 包含 about 数据和最近文章的响应
 */
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

/**
 * 构建关于页面 PUT 响应
 *
 * 更新站点介绍信息，仅限超级管理员操作
 *
 * @param {Request} req - HTTP 请求对象，包含更新数据
 * @returns {Promise<Response>} 更新后的数据
 */
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
