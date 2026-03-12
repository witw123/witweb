/**
 * 友链页面布局
 *
 * 友链相关页面的公共布局，目前仅为透传子组件
 * 设置页面级别 SEO 元数据，定义页面标题和描述
 */

import type { Metadata } from "next";

/**
 * 友链页面元数据
 *
 * 设置标题为"友情链街"，描述为"浏览本站收录的友情链街与推荐站点"
 * 添加规范链接以防止重复内容问题
 */
export const metadata: Metadata = {
  title: "友情链街",
  description: "浏览本站收录的友情链街与推荐站点。",
  alternates: {
    canonical: "/friends",
  },
};

/**
 * FriendsLayout - 友链布局组件
 *
 * 简单的布局透传组件，直接渲染子组件
 * 用于包裹友链相关页面，提供统一的布局结构
 *
 * @param {React.ReactNode} children - 子组件（友链页面内容）
 */
export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
