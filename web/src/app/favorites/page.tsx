/**
 * 收藏页面路由
 *
 * 显示用户收藏的文章列表，用户需要登录后才能访问
 * 实际收藏列表渲染逻辑封装在 FavoritesPage 组件中
 * 页面设置为不收录（robots: false）
 */

"use client";

import FavoritesPage from "@/features/blog/components/FavoritesPage";

/**
 * 收藏页面组件
 *
 * 用户收藏文章列表页面路由组件
 * 将渲染委托给 features/blog/components/FavoritesPage
 *
 * @requires Auth - 需要用户登录才能访问
 */
export default function FavoritesRoute() {
  return <FavoritesPage />;
}

