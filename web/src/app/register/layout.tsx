/**
 * 注册页面布局
 *
 * 注册相关页面的公共布局，目前仅为透传子组件
 * 设置页面级别 SEO 元数据，阻止搜索引擎索引
 */

import type { Metadata } from "next";

/**
 * 注册页面元数据
 *
 * 设置标题为"注册"，并阻止搜索引擎收录
 */
export const metadata: Metadata = {
  title: "注册",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * RegisterLayout - 注册布局组件
 *
 * 简单的布局透传组件，直接渲染子组件
 * 用于包裹注册相关页面，提供统一的布局结构
 *
 * @param {React.ReactNode} children - 子组件（注册页面内容）
 */
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

