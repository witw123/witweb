/**
 * 分类页面
 *
 * 显示所有文章分类的页面
 */

import type { Metadata } from "next";
import CategoriesPage from "@/features/blog/components/CategoriesPage";

/** 页面元数据 */
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
