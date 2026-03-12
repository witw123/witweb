/**
 * 粉丝页面
 *
 * 显示关注当前用户的粉丝列表（需登录）
 */

import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";

const FollowersPageContent = dynamic(
  () => import("@/features/user/components/FollowersPageContent"),
  { loading: () => <div className="app-loading-fallback">加载中...</div> }
);

/** 粉丝页面 */
export default function FollowersPage() {
  return (
    <RequireAuth>
      <FollowersPageContent />
    </RequireAuth>
  );
}
