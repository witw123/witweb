/**
 * 私信消息页面
 *
 * 通过动态导入延后加载较重的消息界面，减少非消息场景首包体积。
 * 页面本身只负责路由入口和加载占位。
 */

import dynamic from "next/dynamic";

const MessagesPageContent = dynamic(
  () => import("@/features/messages/components/MessagesPageContent"),
  { loading: () => <div className="app-loading-fallback">加载中...</div> }
);

export default function MessagesPage() {
  return <MessagesPageContent />;
}
