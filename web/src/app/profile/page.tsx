import { Suspense } from "react";
import ProfilePage from "@/features/user/components/ProfilePage";

export default function ProfileRoute() {
  return (
    <Suspense fallback={<div className="app-loading-fallback">加载中...</div>}>
      <ProfilePage />
    </Suspense>
  );
}
