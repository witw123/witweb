import type { Metadata } from "next";
import { Suspense } from "react";
import BlogListPage from "@/features/blog/components/BlogListPage";

export const metadata: Metadata = {
  title: "首页",
  description: "浏览最新文章、标签与分类内容。",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <BlogListPage />
    </Suspense>
  );
}
