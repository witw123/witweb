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
import { Loading } from "@/components/ui/Loading";

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
 * 使用可见加载态，避免客户端跳转期间用户只看到空白区域。
 */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="container flex min-h-[60vh] items-center justify-center py-16">
          <Loading size="lg" text="首页加载中..." />
        </div>
      }
    >
      <BlogListPage />
    </Suspense>
  );
}
