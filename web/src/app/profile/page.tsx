/**
 * 用户资料页面
 *
 * 显示和编辑当前用户资料
 */

import dynamic from "next/dynamic";

const ProfilePage = dynamic(() => import("@/features/user/components/ProfilePage"), {
  loading: () => <div className="app-loading-fallback">加载中...</div>,
});

/** 用户资料页面 */
export default function ProfileRoute() {
  return <ProfilePage />;
}
