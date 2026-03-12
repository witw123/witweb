/**
 * 文章详情页面路由
 *
 * 根据文章 slug 渲染详情页，并负责生成 SEO 元数据与静态参数。
 * 页面本身保持很薄，把真正的内容展示交给 `BlogPostPage`，这里只承担
 * 路由层和搜索引擎相关职责。
 */

import type { Metadata } from "next";
import BlogPostPage from "@/features/blog/components/BlogPostPage";
import { drizzlePostRepository, userRepository } from "@/lib/repositories";
import { getSiteUrl } from "@/lib/site-url";

/** 详情页 ISR 刷新间隔。 */
export const revalidate = 300;
/** 允许运行时补充尚未在构建阶段预渲染的 slug。 */
export const dynamicParams = true;

/**
 * 去除 Markdown 标记
 *
 * 用于从正文中提取纯文本描述，供页面描述和社交分享摘要复用。
 *
 * @param {string} source - Markdown 原文
 * @returns {string} 去除格式后的纯文本
 */
function stripMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_\-\[\]()`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 动态生成文章页元数据
 *
 * 从文章详情中提取标题、描述、标签和作者信息，生成适合搜索引擎和社交分享的 SEO 配置。
 * 如果文章不存在或查询失败，则返回降级元数据，避免页面元信息完全缺失。
 *
 * @param {{ params: Promise<{ slug: string }> }} context - 路由参数
 * @returns {Promise<Metadata>} 页面元数据
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const { slug } = await params;

  try {
    const post = await drizzlePostRepository.getPostDetail(slug);
    if (!post) {
      return {
        title: "文章不存在",
        robots: { index: false, follow: false },
      };
    }

    const author = await userRepository.findByUsername(post.author);
    const description = stripMarkdown(String(post.content || "")).slice(0, 140) || "查看文章详情";
    const canonical = `/post/${slug}`;
    const tags = String(post.tags || "")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    return {
      title: post.title,
      description,
      keywords: tags.length > 0 ? tags : undefined,
      alternates: {
        canonical,
      },
      openGraph: {
        type: "article",
        url: `${siteUrl}${canonical}`,
        title: post.title,
        description,
        publishedTime: post.created_at || undefined,
        authors: author?.nickname ? [author.nickname] : undefined,
        tags: tags.length > 0 ? tags : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description,
      },
    };
  } catch {
    return {
      title: "文章",
      description: "查看文章详情",
    };
  }
}

/**
 * 生成静态文章参数
 *
 * 构建时预渲染前 100 篇文章，兼顾热门内容首屏性能与整体构建时长。
 *
 * @returns {Promise<Array<{ slug: string }>>} 文章 slug 数组
 */
export async function generateStaticParams() {
  const posts = await drizzlePostRepository.listSitemapPosts();
  return posts.slice(0, 100).map((post) => ({ slug: post.slug }));
}

/**
 * PostPage - 文章详情页入口组件
 *
 * @returns {JSX.Element} 文章详情页
 */
export default function PostPage() {
  return <BlogPostPage />;
}
