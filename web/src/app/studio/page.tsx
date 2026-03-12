/**
 * Studio 页面路由
 *
 * WitWeb 创作工作室入口页面，提供视频生成、AI Agent、热点雷达等创意工具
 * 实际功能布局由 StudioLayout 组件渲染
 */

"use client";

import StudioLayout from "@/components/studio/core/StudioLayout";

/**
 * StudioPage - Studio 页面组件
 *
 * 创作工作室主页，渲染 StudioLayout 组件
 * 提供宽屏布局（最大宽度 1400px）以适应复杂的功能界面
 *
 * @requires Auth - 需要用户登录才能访问
 */
export default function StudioPage() {
  return (
    <div className="app-page-shell">
      <div className="app-page-container w-full max-w-[1400px]">
        <StudioLayout />
      </div>
    </div>
  );
}
