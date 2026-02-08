import type { Metadata } from "next";
import CategoriesPage from "@/features/blog/components/CategoriesPage";

export const metadata: Metadata = {
  title: "文章分类",
  description: "按分类快速浏览站内内容。",
  alternates: {
    canonical: "/categories",
  },
};

export default function Page() {
  return <CategoriesPage />;
}
