import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import FollowersPageContent from "@/features/user/components/FollowersPageContent";

export default function FollowersPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="app-loading-fallback">加载中...</div>}>
        <FollowersPageContent />
      </Suspense>
    </RequireAuth>
  );
}
