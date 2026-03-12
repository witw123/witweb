/**
 * 首页路由
 *
 * 这是公开站点的主入口页面，承担首屏文章流量和 SEO 收录。
 * 页面本身保持很薄，只负责元数据和缓存策略，把列表查询逻辑下沉到
 * BlogListPage，避免路由文件堆积业务状态。
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import BlogListPage from "@/features/blog/components/BlogListPage";

/** 首页 ISR 刷新间隔，平衡文章更新时效与首屏缓存命中率。 */
export const revalidate = 60;

/**
 * 首页元数据
 *
 * 为首页定义基础 SEO 信息，确保根路径具备稳定的标题、描述和 canonical。
 */
export const metadata: Metadata = {
  title: "首页",
  description: "浏览最新文章、标签与分类内容。",
  alternates: {
    canonical: "/",
  },
};

/**
 * HomePage - 首页组件
 *
 * 通过 Suspense 包裹博客列表，允许服务端数据读取以流式方式返回。
 * 这里使用 `null` 作为回退内容，避免首页在极短等待时间内出现额外骨架闪烁。
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <BlogListPage />
    </Suspense>
  );
}
