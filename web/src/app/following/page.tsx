/**
 * 关注页面
 *
 * 显示当前用户关注的用户列表（需登录）
 */

import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";

const FollowingPageContent = dynamic(
  () => import("@/features/user/components/FollowingPageContent"),
  { loading: () => <div className="app-loading-fallback">加载中...</div> }
);

/** 关注页面 */
export default function FollowingPage() {
  return (
    <RequireAuth>
      <FollowingPageContent />
    </RequireAuth>
  );
}
