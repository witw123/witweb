/**
 * 文章加载页面
 *
 * 在文章详情页面数据加载过程中显示的加载占位符
 * 使用 Loading 组件展示"加载文章中..."的提示信息
 * 这是 Next.js 的 Suspense 边界组件
 *
 * @route /post/[slug]
 */

import { Loading } from "@/components/ui/Loading";

/**
 * PostLoading - 文章加载占位组件
 *
 * 当文章详情页面在加载时显示的 Loading 组件
 * 提供用户友好的加载体验
 */
export default function PostLoading() {
  return <Loading text="加载文章中..." />;
}
