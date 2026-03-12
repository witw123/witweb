/**
 * 收藏页面布局
 *
 * 收藏相关页面的公共布局，目前仅为透传子组件
 * 设置页面级别 SEO 元数据，标题为"我的收藏"，阻止搜索引擎索引
 */

import type { Metadata } from "next";

/**
 * 收藏页面元数据
 *
 * 设置标题为"我的收藏"，并阻止搜索引擎收录
 */
export const metadata: Metadata = {
  title: "我的收藏",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * FavoritesLayout - 收藏布局组件
 *
 * 简单的布局透传组件，直接渲染子组件
 * 用于包裹收藏相关页面，提供统一的布局结构
 *
 * @param {React.ReactNode} children - 子组件（收藏页面内容）
 */
export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

