import dynamic from "next/dynamic";

const ProfilePage = dynamic(() => import("@/features/user/components/ProfilePage"), {
  loading: () => <div className="app-loading-fallback">加载中...</div>,
});

export default function ProfileRoute() {
  return <ProfilePage />;
}
