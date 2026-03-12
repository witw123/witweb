/**
 * 登录页面布局
 *
 * 登录相关页面的公共布局，目前仅为透传子组件
 * 设置页面级别 SEO 元数据，阻止搜索引擎索引
 */

import type { Metadata } from "next";

/**
 * 登录页面元数据
 *
 * 设置标题为"登录"，并阻止搜索引擎收录
 */
export const metadata: Metadata = {
  title: "登录",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * LoginLayout - 登录布局组件
 *
 * 简单的布局透传组件，直接渲染子组件
 * 用于包裹登录相关页面，提供统一的布局结构
 *
 * @param {React.ReactNode} children - 子组件（登录页面内容）
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

