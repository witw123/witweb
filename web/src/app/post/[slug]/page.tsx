import type { Metadata } from "next";
import BlogPostPage from "@/features/blog/components/BlogPostPage";
import { drizzlePostRepository, userRepository } from "@/lib/repositories";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 300;
export const dynamicParams = true;

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

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const slug = params.slug;

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

export async function generateStaticParams() {
  const posts = await drizzlePostRepository.listSitemapPosts();
  return posts.slice(0, 100).map((post) => ({ slug: post.slug }));
}

export default function PostPage() {
  return <BlogPostPage />;
}
