/**
 * 发布文章页面
 *
 * 创建和编辑博客文章的页面
 */

import { Suspense } from "react";
import PublishPage from "@/features/blog/components/PublishPage";

/** 发布页面 */
export default function Page() {
  return (
    <Suspense fallback={<div className="container py-12 text-center text-zinc-400">加载中...</div>}>
      <PublishPage />
    </Suspense>
  );
}
